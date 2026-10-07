import type {
  EditorialStory,
  CulturalItem,
  UserMagazinePreferences,
} from "@/types/editorial";
import { storyIdentity, deduplicateStories } from "@/lib/sources/deduplicate";
import { seedNumber } from "@/lib/sources/selection";
export function itemIdentity(item: EditorialStory | CulturalItem): string {
  if (item.contentPolicy === "external") return `url:${storyIdentity(item)}`;
  if ("pageId" in item) return `wikipedia:${item.pageId}`;
  if ("objectId" in item) return `met:${item.objectId}`;
  return item.id;
}
export function publicationIdentity(story: EditorialStory) {
  return story.source.id.startsWith("custom:")
    ? (story.source.feedUrl ?? story.source.id)
    : story.source.id;
}
export interface Selection {
  story: EditorialStory;
  category: string;
}
export function balancedSelection(
  stories: EditorialStory[],
  preferences: UserMagazinePreferences,
  count: number,
  {
    recent = [],
    exclude = [],
    seed = "",
    initial = [],
  }: {
    recent?: string[];
    exclude?: string[];
    seed?: string;
    initial?: Selection[];
  } = {},
) {
  const blocked = new Set(exclude),
    seen = new Set(recent);
  const pool = deduplicateStories(stories).filter(
    (s) => !blocked.has(itemIdentity(s)),
  );
  const chosen: Selection[] = [];
  const sources = new Map<string, number>(),
    categories = new Map<string, number>();
  function record(s: Selection) {
    sources.set(
      publicationIdentity(s.story),
      (sources.get(publicationIdentity(s.story)) ?? 0) + 1,
    );
    categories.set(s.category, (categories.get(s.category) ?? 0) + 1);
  }
  initial.forEach(record);
  while (pool.length && chosen.length < count) {
    const pairs = pool.flatMap((story) => {
      const cats = story.interestIds.filter((id) =>
        preferences.interests.includes(id),
      );
      return (cats.length ? cats : ["publications"]).map((category) => ({
        story,
        category,
      }));
    });
    pairs.sort(
      (a, b) =>
        (categories.get(a.category) ?? 0) - (categories.get(b.category) ?? 0) ||
        Number(seen.has(itemIdentity(a.story))) -
          Number(seen.has(itemIdentity(b.story))) ||
        (sources.get(publicationIdentity(a.story)) ?? 0) -
          (sources.get(publicationIdentity(b.story)) ?? 0) ||
        (b.story.publishedAt ?? "").localeCompare(a.story.publishedAt ?? "") ||
        seedNumber(`${seed}:${a.story.id}:${a.category}`) -
          seedNumber(`${seed}:${b.story.id}:${b.category}`) ||
        a.story.id.localeCompare(b.story.id) ||
        a.category.localeCompare(b.category),
    );
    const next = pairs[0];
    chosen.push(next);
    record(next);
    pool.splice(
      pool.findIndex((s) => s.id === next.story.id),
      1,
    );
  }
  return chosen;
}
