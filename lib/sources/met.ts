import { unstable_cache } from "next/cache";
import { openApiJson } from "./openApi";
import {
  type DiscoverySelection,
  seededOrder,
  discoveryOrder,
  discoveryAttempts,
} from "./selection";
import { sourceCatalog } from "@/data/catalog";
import type { MuseumArtwork } from "@/types/cultural";
export interface MetObject {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  primaryImageSmall?: string;
  title: string;
  artistDisplayName?: string;
  objectDate?: string;
  medium?: string;
  department?: string;
  culture?: string;
  dimensions?: string;
  creditLine?: string;
  accessionNumber?: string;
  objectURL?: string;
  objectName?: string;
}
const source = sourceCatalog.find((item) => item.id === "met")!;
export function normalizeMetObject(
  object: MetObject,
): MuseumArtwork | undefined {
  if (
    object.isPublicDomain !== true ||
    !Number.isInteger(object.objectID) ||
    object.objectID <= 0 ||
    !object.title?.trim() ||
    /^(untitled|fragment|unknown|object)$/i.test(object.title.trim()) ||
    !/^https:\/\/images.metmuseum.org\/[^\s]+$/.test(object.primaryImage) ||
    !object.medium?.trim() ||
    !object.department?.trim() ||
    !object.objectDate?.trim()
  )
    return undefined;
  const originalUrl =
    object.objectURL &&
    /^https:\/\/(www\.)?metmuseum.org\//.test(object.objectURL)
      ? object.objectURL
      : `https://www.metmuseum.org/art/collection/search/${object.objectID}`;
  return {
    id: `met:${object.objectID}`,
    objectId: object.objectID,
    kind: "artwork",
    title: object.title,
    source: {
      ...source,
      license: {
        name: "CC0 1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
    },
    contentPolicy: "reusable",
    isPublicDomain: true,
    artist: object.artistDisplayName || undefined,
    year: object.objectDate,
    medium: object.medium,
    department: object.department,
    culture: object.culture || undefined,
    dimensions: object.dimensions || undefined,
    creditLine: object.creditLine || undefined,
    accessionNumber: object.accessionNumber || undefined,
    originalUrl,
    internalUrl: `/explore/artwork/${object.objectID}`,
    attribution: `The Metropolitan Museum of Art${object.creditLine ? ` · ${object.creditLine}` : ""} · Public domain / CC0`,
    // Met provides no visual alt description. Treat image as decorative beside the complete factual caption; never invent interpretation.
    image: {
      src: object.primaryImage,
      alt: "",
      credit: "The Metropolitan Museum of Art",
      creditUrl: originalUrl,
      license: "Public domain / CC0",
    },
  };
}
export const getMetArtwork = unstable_cache(
  async (id: number) => {
    if (!Number.isInteger(id) || id <= 0 || id > 999999999) return null;
    const raw = await openApiJson<MetObject>(
      `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
    );
    return normalizeMetObject(raw) ?? null;
  },
  ["met-object-v1"],
  { revalidate: 604800 },
);
const artSeeds: Record<string, string[]> = {
  art: ["painting", "landscape"],
  design: ["textile", "ceramics"],
  history: ["antiquity", "portrait"],
  architecture: ["architecture", "interior"],
  travel: ["landscape", "map"],
  music: ["musical instrument"],
  books: ["manuscript"],
  photography: ["photograph"],
  nature: ["flowers", "landscape"],
  creativity: ["drawing"],
  food: ["still life"],
};
const searchMet = unstable_cache(
  async (query: string) => {
    // Current paginated endpoint; v1/search was retired October 1, 2026.
    const data = await openApiJson<{ objectIDs?: number[] }>(
      `https://collectionapi.metmuseum.org/public/collection/v1.1/search?${new URLSearchParams({ q: query, hasImages: "true", isHighlight: "true", limit: "100", offset: "0" })}`,
    );
    return [...new Set(data.objectIDs ?? [])]
      .filter(Number.isInteger)
      .sort((a, b) => a - b);
  },
  ["met-search-v1.1"],
  { revalidate: 604800 },
);
export const getArtworkForIssue = unstable_cache(
  async (
    date: string,
    interestIds: string[],
    selection: DiscoverySelection = {},
  ) => {
    const key = `${date}:${[...interestIds].sort().join(",")}`;
    const seeds = seededOrder(
      [...new Set(interestIds.flatMap((id) => artSeeds[id] ?? []))],
      key,
      (seed) => seed,
    );
    const queries = [...seeds.slice(0, 1), "painting"];
    for (const query of [...new Set(queries)]) {
      let ids: number[];
      try {
        ids = await searchMet(query);
      } catch {
        continue;
      }
      const identity = (id: number) => `met:${id}`;
      const candidates = discoveryAttempts(
        discoveryOrder(ids, key, identity, selection),
        identity,
        selection.recent ?? [],
        8,
      );
      for (let i = 0; i < candidates.length; i += 4) {
        const objects = await Promise.allSettled(
          candidates.slice(i, i + 4).map(getMetArtwork),
        );
        const seen = new Set<string>();
        for (const result of objects) {
          if (result.status === "fulfilled" && result.value) {
            const item = result.value;
            if (selection.excludeImages?.includes(item.image!.src)) continue;
            const identity = item.accessionNumber ?? item.image!.src;
            if (seen.has(identity)) continue;
            seen.add(identity);
            return item;
          }
        }
      }
    }
    throw new Error("No reusable Met artwork is available.");
  },
  ["daily-met-artwork-v1"],
  { revalidate: 86400 },
);
