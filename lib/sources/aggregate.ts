import { publisherPolicy } from "@/lib/content/policies";
import { unstable_cache } from "next/cache";
import { enabledSources } from "./registry";
import { readRss } from "./rss";
import { deduplicateStories } from "./deduplicate";
import type { Source, UserMagazinePreferences } from "@/types/editorial";
import type { AggregationResult, SourceResult } from "./types";

// Keep the existing non-Cache-Components app: Next Data Cache, 30 minute revalidation.
const cachedRss = unstable_cache(readRss, ["rss-metadata-v1"], {
  revalidate: 1800,
});
export async function getStoriesForSource(
  source: Source,
): Promise<SourceResult> {
  if (
    source.contentPolicy.destination !== "external" ||
    !["rss", "substack"].includes(source.sourceType)
  )
    throw new Error("This provider is not integrated yet.");
  return cachedRss(source);
}
export function resolveSources(preferences: UserMagazinePreferences): Source[] {
  const explicit =
    preferences.sources.length + preferences.customSources.length > 0;
  const chosen = enabledSources.filter((source) =>
    explicit
      ? preferences.sources.includes(source.id)
      : source.categories.some((id) => preferences.interests.includes(id)),
  );
  // One curated candidate outside all selected interests. Unmatched stories are used only in the outside module.
  const outside = enabledSources.find(
    (source) =>
      !source.categories.some((id) => preferences.interests.includes(id)) &&
      !chosen.some((item) => item.id === source.id),
  );
  const customs = preferences.customSources
    .filter((source) => source.feedUrl)
    .slice(0, 8)
    .map((source) => ({
      ...source,
      contentPolicy: publisherPolicy,
      sourceType:
        source.sourceType === "substack"
          ? ("substack" as const)
          : ("rss" as const),
    }));
  return [...chosen, ...customs, ...(outside ? [outside] : [])];
}
export async function getStoriesForSources(
  sources: Source[],
  provider: (source: Source) => Promise<SourceResult> = getStoriesForSource,
): Promise<AggregationResult> {
  const results = await Promise.allSettled(sources.map(provider));
  const stories: AggregationResult["stories"] = [],
    failed: AggregationResult["failed"] = [],
    loaded: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.stories.length) {
      stories.push(...result.value.stories);
      loaded.push(sources[index].id);
    } else
      failed.push({
        id: sources[index].id,
        name: sources[index].name,
        reason:
          result.status === "rejected"
            ? String(result.reason)
            : "No readable stories in this feed.",
      });
  });
  return { stories: deduplicateStories(stories), failed, loaded };
}
