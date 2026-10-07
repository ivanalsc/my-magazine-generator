import "server-only";
import { getPickById } from "@/lib/picks/providers";
import { PICK_TYPES } from "@/lib/picks/model";
import type { CulturalPick } from "@/types/pick";
import { getWikipediaDiscovery } from "@/lib/sources/wikipedia";
import { getMetArtwork } from "@/lib/sources/met";
import { culturalItems } from "@/data/mock/issue";
import { makeSavedEntry } from "./supabase";
import type { SavedItem } from "@/types/saved";
export async function verifySavedEntry(entry: SavedItem): Promise<SavedItem> {
  if (entry.kind === "externalArticle") return entry;
  const item = PICK_TYPES.includes(entry.kind as (typeof PICK_TYPES)[number])
    ? await getPickById(
        (entry.item as CulturalPick).mediaType,
        String((entry.item as CulturalPick).providerId),
      )
    : entry.kind === "wikipediaDiscovery"
      ? await getWikipediaDiscovery(entry.item.pageId)
      : entry.kind === "artwork"
        ? await getMetArtwork(entry.item.objectId)
        : culturalItems.find((item) => item.id === entry.item.id);
  if (!item)
    throw new Error(
      "This discovery’s source could not be verified. Try again later.",
    );
  const verified = makeSavedEntry(item);
  if (!verified) throw new Error("This discovery could not be saved.");
  return { ...verified, savedAt: entry.savedAt };
}
