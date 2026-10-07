import { selectCulturalPick } from "@/lib/picks/select";
import { sameOrigin } from "@/lib/http/origin";
import { accountSession } from "@/lib/supabase/server";
import { SupabaseLibraryRepository } from "@/lib/repositories/supabase";
import { readSmallJson } from "@/lib/sources/request";
import { getStoriesForSources, resolveSources } from "@/lib/sources/aggregate";
import { validateCustomFeed } from "@/lib/sources/rss";
import { unstable_cache } from "next/cache";
import { getRabbitHole } from "@/lib/sources/wikipedia";
import { getArtworkForIssue } from "@/lib/sources/met";
import {
  refreshStorySection,
  refreshCulturalItem,
} from "@/lib/editorial/refresh";
import { itemIdentity } from "@/lib/editorial/selection";
import { parseGuestIssue } from "@/lib/editorial/guest";
export const runtime = "nodejs";
const validatedCustom = unstable_cache(
  validateCustomFeed,
  ["custom-feed-validation-v1"],
  { revalidate: 1800 },
);
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = (await readSmallJson(request, 2_000_000)) as {
      issueId?: string;
      sectionId?: string;
      expectedRevision?: number;
      envelope?: unknown;
    };
    if (
      !input ||
      typeof input.sectionId !== "string" ||
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision! < 0
    )
      return Response.json(
        { error: "Invalid refresh request." },
        { status: 400 },
      );
    const session = await accountSession();
    const repository = session
      ? new SupabaseLibraryRepository(session.client, session.userId)
      : null;
    const current =
      repository && typeof input.issueId === "string"
        ? await repository.issue(input.issueId)
        : repository
          ? null
          : parseGuestIssue(input.envelope);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    if (!current || current.issue.date !== date)
      return Response.json(
        { error: "Only today’s issue can have another selection." },
        { status: 400 },
      );
    if (repository && !current.refreshAvailable)
      return Response.json(
        {
          error:
            "Another selection will be available when the library update is applied. Your current issue is safe.",
        },
        { status: 503 },
      );
    if ((current.revision ?? 0) !== input.expectedRevision)
      return Response.json(
        {
          error:
            "Your issue changed in another tab. Reload before choosing another selection.",
        },
        { status: 409 },
      );
    const section = input.sectionId;
    if (
      section === "lead" ||
      section === "on-this-day" ||
      !(
        current.issue.sections.some((s) => s.id === section) ||
        current.issue.culturalItems.some((i) => i.kind === section)
      )
    )
      return Response.json(
        { error: "This section keeps its original selection." },
        { status: 400 },
      );
    const recent = [
      ...(current.recentSelections ?? []),
      ...(repository ? await repository.recentHistory(date) : []),
    ];
    const counter = (current.revision ?? 0) + 1;
    let replacement = null;
    if (section === "cultural-pick") {
      const item = await selectCulturalPick(
        date,
        current.preferences.interests,
        {
          recent,
          counter,
          exclude: current.issue.culturalItems.map(itemIdentity),
        },
      );
      if (item)
        replacement = {
          ...current.issue,
          culturalItems: current.issue.culturalItems.map((i) =>
            i.kind === "cultural-pick" ? item : i,
          ),
        };
    } else if (section === "rabbit-hole" || section === "artwork") {
      const options = {
        recent,
        exclude: current.issue.culturalItems.map(itemIdentity),
        counter,
        excludeImages:
          section === "artwork"
            ? current.issue.culturalItems
                .filter((i) => i.kind === "artwork")
                .flatMap((i) => (i.image ? [i.image.src] : []))
            : [],
      };
      const provider =
        section === "rabbit-hole" ? getRabbitHole : getArtworkForIssue;
      const item = await provider(date, current.preferences.interests, options);
      replacement = refreshCulturalItem(current.issue, section, item);
    } else {
      // Only the relevant publishers; existing cached RSS pools serve repeat requests.
      const currentIds = new Set(
        current.issue.stories
          .filter((s) =>
            current.issue.sections
              .find((group) => group.id === section)
              ?.storyIds.includes(s.id),
          )
          .map((s) => s.source.id),
      );
      const checked = await Promise.allSettled(
        current.preferences.customSources.map((s) =>
          validatedCustom(s.feedUrl!),
        ),
      );
      const preferences = {
        ...current.preferences,
        customSources: checked.flatMap((r) =>
          r.status === "fulfilled" ? [r.value] : [],
        ),
      };
      const sources = resolveSources(preferences).filter((s) =>
        section === "outside"
          ? !s.categories.some((id) => preferences.interests.includes(id))
          : section === "publications" ||
            s.categories.includes(section) ||
            currentIds.has(s.id),
      );
      const result = await getStoriesForSources(sources);
      replacement = refreshStorySection(
        current.issue,
        section,
        result.stories,
        current.preferences,
        recent,
        counter,
      );
    }
    if (!replacement)
      return Response.json(
        {
          changed: false,
          message:
            "No other discoveries available right now. Your current selection is kept.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const next = {
      ...current,
      issue: replacement,
      revision: counter,
      recentSelections: [
        ...new Set([
          ...recent,
          ...current.issue.stories.map(itemIdentity),
          ...current.issue.culturalItems.map(itemIdentity),
        ]),
      ].slice(-300),
    };
    const accepted = repository
      ? await repository.reviseIssue(next, section, input.expectedRevision!)
      : next;
    return Response.json(
      {
        changed: true,
        envelope: accepted,
        message: "Another selection is ready.",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "We couldn’t replace this section. Your current selection is kept. Try again in a moment.",
      },
      { status: 503 },
    );
  }
}
