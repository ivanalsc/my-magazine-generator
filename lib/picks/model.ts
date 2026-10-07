import type { CulturalPick } from "@/types/pick";
import type { Source } from "@/types/editorial";
export type PickType = CulturalPick["mediaType"];
export const PICK_TYPES = ["film", "tv", "book", "album"] as const;
export const mapping: Record<string, PickType[]> = {
  music: ["album"],
  books: ["book"],
  film: ["film", "tv"],
  art: ["film", "book", "album"],
  design: ["book", "film"],
  creativity: ["book", "album", "film"],
  history: ["book", "film"],
  psychology: ["book", "film", "tv"],
  ideas: ["book", "film", "album"],
  technology: ["book", "film"],
  science: ["book", "film"],
  architecture: ["book", "film"],
  photography: ["book", "film"],
  travel: ["book", "film"],
  food: ["book", "film"],
  nature: ["book", "film"],
};
export function eligibleTypes(ids: string[]): PickType[] {
  const direct = ids.flatMap((id) =>
    id === "music"
      ? ["album" as const]
      : id === "books"
        ? ["book" as const]
        : id === "film"
          ? ["film" as const, "tv" as const]
          : [],
  );
  return [...new Set([...direct, ...ids.flatMap((id) => mapping[id] ?? [])])];
}
export function pickSource(
  provider: CulturalPick["provenance"]["provider"],
): Source {
  const info = {
    tmdb: [
      "TMDB",
      "https://www.themoviedb.org",
      "https://www.themoviedb.org/api-terms-of-use",
    ],
    openlibrary: [
      "Open Library",
      "https://openlibrary.org",
      "https://openlibrary.org/developers/api",
    ],
    musicbrainz: [
      "MusicBrainz",
      "https://musicbrainz.org",
      "https://musicbrainz.org/doc/About/Data_License",
    ],
  }[provider];
  return {
    id: provider,
    slug: provider,
    name: info[0],
    websiteUrl: info[1],
    sourceType: "api",
    categories: [],
    contentPolicy: {
      destination: "internal",
      canDisplayTitle: true,
      canDisplayAuthor: true,
      canDisplayDate: true,
      canDisplayExcerpt: false,
      canDisplayFullText: false,
      canDisplayImage: provider !== "musicbrainz",
      license: info[2],
    },
  };
}
export function pickBase(
  provider: CulturalPick["provenance"]["provider"],
  mediaType: PickType,
  providerId: string | number,
  title: string,
  creators: string[],
  year?: string,
) {
  const id =
    provider === "tmdb"
      ? `tmdb:${mediaType === "film" ? "movie" : "tv"}:${providerId}`
      : `${provider}:${providerId}`;
  const source = pickSource(provider);
  const originalUrl =
    provider === "tmdb"
      ? `${source.websiteUrl}/${mediaType === "film" ? "movie" : "tv"}/${providerId}`
      : provider === "openlibrary"
        ? `${source.websiteUrl}/works/${providerId}`
        : `${source.websiteUrl}/release-group/${providerId}`;
  const fetchedAt = new Date().toISOString();
  return {
    id,
    kind: "cultural-pick" as const,
    title,
    creators,
    artist: creators.join(", ") || undefined,
    year,
    source,
    contentPolicy: "reusable" as const,
    originalUrl,
    internalUrl: `/explore/${mediaType}/${providerId}`,
    attribution: `Metadata: ${source.name}`,
    interestIds: [] as string[],
    topics: [] as string[],
    provenance: {
      provider,
      fetchedAt,
      termsUrl: source.contentPolicy.license!,
      ...(provider === "tmdb"
        ? { expiresAt: new Date(Date.now() + 150 * 86400000).toISOString() }
        : {}),
    },
  };
}
export function validPick(input: unknown): input is CulturalPick {
  if (!input || typeof input !== "object") return false;
  const p = input as CulturalPick;
  if (
    p.kind !== "cultural-pick" ||
    !PICK_TYPES.includes(p.mediaType) ||
    !p.title?.trim() ||
    !Array.isArray(p.creators) ||
    !p.creators.every((c) => typeof c === "string") ||
    !Array.isArray(p.topics) ||
    !p.topics.every((t) => typeof t === "string") ||
    !Array.isArray(p.interestIds) ||
    !p.interestIds.every((i) => typeof i === "string")
  )
    return false;
  const provider =
    p.mediaType === "film" || p.mediaType === "tv"
      ? "tmdb"
      : p.mediaType === "book"
        ? "openlibrary"
        : "musicbrainz";
  if (
    p.provenance?.provider !== provider ||
    p.source?.id !== provider ||
    p.contentPolicy !== "reusable" ||
    !Number.isFinite(Date.parse(p.provenance.fetchedAt))
  )
    return false;
  if (
    provider === "tmdb" &&
    (!Number.isInteger(p.providerId) ||
      Number(p.providerId) <= 0 ||
      !p.provenance.expiresAt ||
      !Number.isFinite(Date.parse(p.provenance.expiresAt)) ||
      Date.parse(p.provenance.expiresAt) < Date.now() ||
      Date.parse(p.provenance.expiresAt) >
        Date.parse(p.provenance.fetchedAt) + 151 * 86400000)
  )
    return false;
  if (
    provider === "openlibrary" &&
    !/^OL[1-9][0-9]*W$/.test(String(p.providerId))
  )
    return false;
  if (
    provider === "musicbrainz" &&
    (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      String(p.providerId),
    ) ||
      p.image ||
      p.mediaType !== "album" ||
      p.primaryType !== "Album")
  )
    return false;
  const canonical = pickBase(
    provider,
    p.mediaType,
    p.providerId,
    p.title,
    p.creators,
    p.year,
  );
  if (
    p.id !== canonical.id ||
    p.originalUrl !== canonical.originalUrl ||
    p.internalUrl !== canonical.internalUrl
  )
    return false;
  if (
    p.image &&
    !(
      provider === "tmdb"
        ? /^https:\/\/image.tmdb.org\/t\/p\/w500\/[A-Za-z0-9._-]+$/
        : /^https:\/\/covers.openlibrary.org\/b\/id\/[1-9][0-9]*-L.jpg(?:\?default=false)?$/
    ).test(p.image.src)
  )
    return false;
  return true;
}
export function cleanPick(p: CulturalPick): CulturalPick {
  const base = pickBase(
    p.provenance.provider,
    p.mediaType,
    p.providerId,
    p.title,
    p.creators,
    p.year,
  );
  return {
    ...base,
    mediaType: p.mediaType,
    providerId: p.providerId,
    topics: p.topics,
    interestIds: p.interestIds,
    provenance: p.provenance,
    attribution: p.attribution,
    ...(p.mediaType === "album" ? { primaryType: "Album" as const } : {}),
    ...(p.mediaType === "book" && p.coverId ? { coverId: p.coverId } : {}),
    ...(p.image && p.mediaType !== "album" ? { image: p.image } : {}),
  } as CulturalPick;
}
