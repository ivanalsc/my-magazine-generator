import { publisherPolicy } from "@/lib/content/policies";
import { interests, sourceCatalog } from "@/data/catalog";
import type { Source, UserMagazinePreferences } from "@/types/editorial";
export const PREFERENCES_KEY = "my-magazine-generator:preferences:v1";
export const MIN_INTERESTS = 3;
export function normalizeSourceUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost")
      return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
export function sourceUrlKey(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname.replace(/^www\./, "")}${parsed.port ? ":" + parsed.port : ""}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
}
export function createCustomSource(url: string): Source {
  const parsed = new URL(url);
  return {
    id: `custom:${sourceUrlKey(url)}`,
    slug: parsed.hostname,
    name: parsed.hostname.replace(/^www\./, ""),
    websiteUrl: url,
    sourceType: "custom",
    contentPolicy: publisherPolicy,
    categories: [],
    description: "Added by you",
  };
}
export function parsePreferences(
  raw: string | null | undefined,
): UserMagazinePreferences | null {
  if (!raw) return null;
  try {
    const record: unknown = JSON.parse(raw);
    if (!record || typeof record !== "object") return null;
    const value = record as Record<string, unknown>;
    if (
      value.version !== 1 ||
      !Array.isArray(value.interests) ||
      !Array.isArray(value.sources) ||
      !Array.isArray(value.customSources)
    )
      return null;
    const selectedInterests = [
      ...new Set(
        value.interests.filter(
          (id): id is string =>
            typeof id === "string" &&
            interests.some((interest) => interest.id === id),
        ),
      ),
    ];
    if (selectedInterests.length < MIN_INTERESTS) return null;
    const selectedSources = [
      ...new Set(
        value.sources.filter(
          (id): id is string =>
            typeof id === "string" &&
            sourceCatalog.some((source) => source.id === id),
        ),
      ),
    ];
    const customSources: Source[] = [];
    for (const entry of value.customSources.slice(0, 8)) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.websiteUrl !== "string"
      )
        continue;
      const url = normalizeSourceUrl(entry.websiteUrl);
      if (!url) continue;
      const catalogSource = sourceCatalog.find(
        (source) => sourceUrlKey(source.websiteUrl) === sourceUrlKey(url),
      );
      if (catalogSource && !entry.feedUrl) {
        if (!selectedSources.includes(catalogSource.id))
          selectedSources.push(catalogSource.id);
        continue;
      }
      const source = createCustomSource(url);
      const feedUrl =
        typeof entry.feedUrl === "string"
          ? normalizeSourceUrl(entry.feedUrl)
          : null;
      if (feedUrl) {
        source.feedUrl = feedUrl;
        source.id = `custom:${sourceUrlKey(feedUrl)}`;
        source.name =
          typeof entry.name === "string"
            ? entry.name.slice(0, 200)
            : source.name;
        source.sourceType =
          entry.sourceType === "substack" ? "substack" : "rss";
        source.description = "Verified RSS / Atom feed";
      }
      if (!customSources.some((item) => item.id === source.id))
        customSources.push(source);
    }
    return {
      version: 1,
      interests: selectedInterests,
      sources: selectedSources,
      customSources,
    };
  } catch {
    return null;
  }
}
export function selectedInterestNames(preferences: UserMagazinePreferences) {
  return interests
    .filter((interest) => preferences.interests.includes(interest.id))
    .map((interest) => interest.name);
}
export function sourcesForPreferences(
  preferences: UserMagazinePreferences,
): Source[] {
  if (preferences.sources.length || preferences.customSources.length)
    return [
      ...sourceCatalog.filter((source) =>
        preferences.sources.includes(source.id),
      ),
      ...preferences.customSources,
    ];
  // Default catalog suggestions use explicit interest mappings.
  return sourceCatalog.filter(
    (source) =>
      source.contentPolicy.destination === "internal" ||
      source.categories.some((category) =>
        preferences.interests.includes(category),
      ),
  );
}
