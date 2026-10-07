import { validPick, PICK_TYPES } from "@/lib/picks/model";
import {
  prepareStoryForDisplay,
  prepareCulturalForDisplay,
} from "@/lib/content/prepare";
import type { EditorialStory, CulturalItem } from "@/types/editorial";
import type { WikipediaDiscovery, MuseumArtwork } from "@/types/cultural";
import type { SavedItem } from "@/types/saved";
export function savedKey(item: EditorialStory | CulturalItem) {
  return item.contentPolicy === "external"
    ? `story:${item.url}`
    : `cultural:${item.id}`;
}
export function parseSaved(raw: string | null | undefined): SavedItem[] {
  try {
    const value = JSON.parse(raw ?? "null");
    if (![1, 2].includes(value?.version) || !Array.isArray(value.items))
      return [];
    // Read v1 without erasing existing clippings; write the new union on the next change.
    value.items = value.items
      .filter((entry: unknown) => !!entry && typeof entry === "object")
      .map((entry: { kind: string; item?: CulturalItem }) => ({
        ...entry,
        kind:
          entry.kind === "story"
            ? "externalArticle"
            : entry.kind === "cultural"
              ? "legacyCultural"
              : entry.kind,
      }));
    return value.items
      .filter((entry: SavedItem) => {
        const item = entry?.item;
        if (
          !item ||
          typeof item.title !== "string" ||
          typeof item.id !== "string" ||
          typeof item.source?.name !== "string" ||
          typeof entry.savedAt !== "string" ||
          !Number.isFinite(Date.parse(entry.savedAt))
        )
          return false;
        if (
          [
            item.image?.src,
            item.image?.alt,
            item.image?.credit,
            item.image?.creditUrl,
          ].some((value) => value !== undefined && typeof value !== "string")
        )
          return false;
        if (
          item.image &&
          !(
            item.image.src?.startsWith("/images/") ||
            /^https?:\/\//.test(item.image.src)
          )
        )
          return false;
        if (
          entry.kind === "externalArticle" &&
          item.contentPolicy === "external"
        ) {
          return (
            typeof item.url === "string" &&
            /^https?:\/\//.test(item.url) &&
            typeof item.category === "string" &&
            Array.isArray(item.interestIds) &&
            item.interestIds.every((id) => typeof id === "string") &&
            [item.author, item.excerpt, item.publishedAt].every(
              (value) => value === undefined || typeof value === "string",
            ) &&
            (item.readingTime === undefined ||
              typeof item.readingTime === "number")
          );
        }
        if (PICK_TYPES.includes(entry.kind as (typeof PICK_TYPES)[number]))
          return (
            validPick(item) &&
            "mediaType" in item &&
            item.mediaType === entry.kind
          );
        if (entry.kind === "wikipediaDiscovery") {
          const wiki = item as WikipediaDiscovery;
          if (
            wiki.source.id !== "wikipedia" ||
            wiki.source.sourceType !== "wikipedia" ||
            !Number.isInteger(wiki.pageId) ||
            wiki.pageId <= 0 ||
            typeof wiki.extract !== "string" ||
            typeof wiki.textLicense?.name !== "string" ||
            typeof wiki.textLicense?.url !== "string"
          )
            return false;
        }
        if (entry.kind === "artwork") {
          const artwork = item as MuseumArtwork;
          if (
            artwork.source.id !== "met" ||
            artwork.source.sourceType !== "museum" ||
            !Number.isInteger(artwork.objectId) ||
            artwork.objectId <= 0 ||
            artwork.isPublicDomain !== true ||
            typeof artwork.medium !== "string" ||
            typeof artwork.department !== "string"
          )
            return false;
        }
        return (
          ["wikipediaDiscovery", "artwork", "legacyCultural"].includes(
            entry.kind,
          ) &&
          item.contentPolicy === "reusable" &&
          typeof item.internalUrl === "string" &&
          /^(\/discover\/[a-z0-9-]+|\/explore\/(wikipedia|artwork)\/[1-9][0-9]*)$/.test(
            item.internalUrl,
          ) &&
          typeof item.attribution === "string" &&
          [item.artist, item.year, item.description, item.kind].every(
            (value) => value === undefined || typeof value === "string",
          )
        );
      })
      .map((entry: SavedItem) => ({
        ...entry,
        item:
          entry.kind === "externalArticle"
            ? prepareStoryForDisplay(entry.item)
            : prepareCulturalForDisplay(entry.item),
        key: savedKey(entry.item),
      }));
  } catch {
    return [];
  }
}
