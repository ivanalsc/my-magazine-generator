import { selectCulturalPick } from "@/lib/picks/select";
import { sameOrigin } from "@/lib/http/origin";
import { accountSession } from "@/lib/supabase/server";
import { SupabaseLibraryRepository } from "@/lib/repositories/supabase";
import { prepareIssueForDisplay } from "@/lib/content/prepare";
import { getCulturalContent } from "@/lib/sources/cultural";
import { unstable_cache } from "next/cache";
import { parsePreferences } from "@/lib/preferences";
import { getStoriesForSources, resolveSources } from "@/lib/sources/aggregate";
import { enabledSources } from "@/lib/sources/registry";
import { validateCustomFeed } from "@/lib/sources/rss";
import { readSmallJson } from "@/lib/sources/request";
import {
  buildMagazineIssue,
  matchesPreferences,
} from "@/lib/buildMagazineIssue";
import { stories as mockStories } from "@/data/mock/issue";
export const runtime = "nodejs";
const validatedCustom = unstable_cache(
  validateCustomFeed,
  ["custom-feed-validation-v1"],
  { revalidate: 1800 },
);
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readSmallJson(request);
    const session = await accountSession();
    const repository = session
      ? new SupabaseLibraryRepository(session.client, session.userId)
      : null;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (repository) {
      const existing = await repository.issueForDate(date);
      if (existing)
        return Response.json(existing, {
          headers: { "Cache-Control": "private, no-store" },
        });
    }
    const preferences = repository
      ? await repository.preferences()
      : parsePreferences(JSON.stringify(input));
    if (!preferences)
      return Response.json(
        { error: "Choose at least three valid interests." },
        { status: 400 },
      );
    // Local preferences are untrusted: reconstruct custom source metadata on the server.
    const checked = await Promise.allSettled(
      preferences.customSources.map(async (source) => {
        if (!source.feedUrl)
          throw new Error("Add this source again to verify its feed.");
        return validatedCustom(source.feedUrl);
      }),
    );
    const customFailures = checked.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            {
              id: preferences.customSources[index].id,
              name: preferences.customSources[index].name,
              reason: String(result.reason),
            },
          ]
        : [],
    );
    const resolvedPreferences = {
      ...preferences,
      customSources: checked.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      ),
    };
    const recent = repository ? await repository.recentHistory(date) : [];
    const [result, cultural, pick] = await Promise.all([
      getStoriesForSources(resolveSources(resolvedPreferences)),
      getCulturalContent(date, resolvedPreferences.interests, undefined, {
        recent,
      }),
      selectCulturalPick(date, resolvedPreferences.interests, { recent }),
    ]);
    const fallback =
      process.env.NODE_ENV === "development" &&
      !result.stories.some((story) =>
        matchesPreferences(story, resolvedPreferences),
      );
    const issue = prepareIssueForDisplay(
      buildMagazineIssue({
        preferences: resolvedPreferences,
        stories: fallback
          ? [...result.stories, ...mockStories]
          : result.stories,
        date,
        culturalContent: cultural.content,
        recent,
      }),
    );
    if (pick) issue.culturalItems.push(pick);
    const failed = [...customFailures, ...result.failed];
    const unconnected = preferences.sources.filter(
      (id) => !enabledSources.some((source) => source.id === id),
    ).length;
    const generated = {
      preferences: resolvedPreferences,
      issue,
      fallback,
      partial: failed.length > 0 || unconnected > 0,
      loadedCount: result.loaded.length,
    };
    const response = repository
      ? await repository.createIssue(generated)
      : generated;
    // Opt-in development inspection, absent from production responses and UI.
    return Response.json(
      process.env.NODE_ENV === "development" &&
        new URL(request.url).searchParams.has("debug")
        ? {
            ...response,
            debug: {
              enabled: enabledSources.map(({ id, feedUrl }) => ({
                id,
                feedUrl,
              })),
              failed,
              fetched: result.stories.length,
              recentHistory: recent.length,
              sourceUse: Object.fromEntries(
                [...new Set(issue.stories.map((s) => s.source.id))].map(
                  (id) => [
                    id,
                    issue.stories.filter((s) => s.source.id === id).length,
                  ],
                ),
              ),
              stories: result.stories,
              composition: issue.sections,
              culturalFailures: cultural.failed,
            },
          }
        : response,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "We couldn’t load or save your issue. Please try again; your existing library is safe.",
      },
      { status: 500 },
    );
  }
}
