import type { CulturalItem } from "@/types/editorial";
import type { CulturalPick } from "@/types/pick";
export function persistenceSnapshot(item: CulturalItem): unknown {
  if (
    item.kind !== "cultural-pick" ||
    !("mediaType" in item) ||
    !["film", "tv"].includes(String(item.mediaType))
  )
    return item;
  const p = item as CulturalPick;
  // Durable user selection, not a permanent copy of TMDB API content.
  return {
    id: p.id,
    kind: p.kind,
    mediaType: p.mediaType,
    providerId: p.providerId,
    contentPolicy: p.contentPolicy,
    originalUrl: p.originalUrl,
    internalUrl: p.internalUrl,
    source: {
      id: "tmdb",
      name: "TMDB",
      sourceType: "api",
      websiteUrl: "https://www.themoviedb.org",
    },
    pointerOnly: true,
  };
}
export async function hydratePickSnapshot(raw: unknown): Promise<unknown> {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("pointerOnly" in raw) ||
    !raw.pointerOnly
  )
    return raw;
  const ref = raw as unknown as {
    mediaType: "film" | "tv";
    providerId: number;
    id: string;
  };
  if (
    !["film", "tv"].includes(ref.mediaType) ||
    !Number.isInteger(ref.providerId) ||
    ref.providerId <= 0
  )
    return raw;
  const { getPickById } = await import("./providers");
  try {
    const item = await getPickById(ref.mediaType, String(ref.providerId));
    if (item) return item;
  } catch {}
  const { pickBase } = await import("./model");
  return {
    ...pickBase(
      "tmdb",
      ref.mediaType,
      ref.providerId,
      ref.mediaType === "film"
        ? "Film unavailable for now"
        : "Series unavailable for now",
      [],
    ),
    mediaType: ref.mediaType,
    providerId: ref.providerId,
  };
}
