import type { EditorialStory } from "@/types/editorial";
export function storyIdentity(
  story: Pick<EditorialStory, "url" | "title" | "source">,
): string {
  return (
    canonicalArticleUrl(story.url) ??
    `${story.source.id}:${story.title.trim().toLowerCase().replace(/\s+/g, " ")}`
  );
}
export function canonicalArticleUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}${url.search}`;
  } catch {
    return null;
  }
}
export function deduplicateStories(stories: EditorialStory[]) {
  const seen = new Set<string>();
  return [...stories]
    .sort(
      (a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") ||
        a.id.localeCompare(b.id),
    )
    .filter((story) => {
      const identity = storyIdentity(story);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}
