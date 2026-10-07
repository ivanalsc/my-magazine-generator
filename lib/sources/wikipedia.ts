import { unstable_cache } from "next/cache";
import { openApiJson } from "./openApi";
import {
  type DiscoverySelection,
  seededOrder,
  discoveryOrder,
  discoveryAttempts,
} from "./selection";
import { plainText } from "./rss";
import type { WikipediaDiscovery, LicensedImage } from "@/types/cultural";
import { sourceCatalog } from "@/data/catalog";

export const topicSeeds: Record<string, string[]> = {
  art: ["Art movements", "Visual arts"],
  design: ["Design movements", "Typography"],
  creativity: ["Creativity", "Art techniques"],
  music: ["Music genres", "Musical techniques"],
  books: ["Literary movements", "History of books"],
  science: ["Natural phenomena", "Scientific theories"],
  technology: ["History of technology", "Emerging technologies"],
  architecture: ["Architectural styles", "Vernacular architecture"],
  travel: ["Cultural landscapes", "Trade routes"],
  history: ["Ancient civilizations", "Historical eras"],
  psychology: ["Cognitive psychology", "Psychological phenomena"],
  ideas: ["Philosophical concepts", "Schools of thought"],
  photography: ["Photographic processes", "History of photography"],
  film: ["Film genres", "Cinematic techniques"],
  food: ["Food culture", "Fermentation"],
  nature: ["Ecological succession", "Natural phenomena"],
};
export interface WikiPage {
  pageid: number;
  ns?: number;
  title: string;
  extract?: string;
  fullurl?: string;
  lastrevid?: number;
  length?: number;
  missing?: boolean;
  pageprops?: { disambiguation?: string };
  pageimage?: string;
  thumbnail?: { source: string; width?: number };
}
const source = sourceCatalog.find((item) => item.id === "wikipedia")!;
export const wikiLicense = {
  name: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};
function query(params: Record<string, string>) {
  return `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params })}`;
}
export function normalizeWikipedia(
  page: WikiPage,
  image?: LicensedImage,
): WikipediaDiscovery | undefined {
  if (
    !Number.isInteger(page.pageid) ||
    page.pageid <= 0 ||
    page.missing ||
    (page.ns !== undefined && page.ns !== 0) ||
    page.pageprops?.disambiguation !== undefined ||
    /^(Lists? of|Timeline of|Index of|Glossary of|Outline of|Category:|Wikipedia:)/i.test(
      page.title,
    ) ||
    !page.extract ||
    page.extract.length < 200 ||
    (page.length !== undefined && page.length < 1500)
  )
    return undefined;
  const originalUrl =
    page.fullurl && /^https:\/\/en.wikipedia.org\//.test(page.fullurl)
      ? page.fullurl
      : `https://en.wikipedia.org/?curid=${page.pageid}`;
  // Use the first source paragraph for the card; preserve the full API intro on the feature page.
  return {
    id: `wikipedia:${page.pageid}`,
    kind: "rabbit-hole",
    pageId: page.pageid,
    revisionId: page.lastrevid,
    title: page.title,
    extract: page.extract,
    description: page.extract.split(/\n+/)[0],
    image,
    source: { ...source, license: wikiLicense },
    contentPolicy: "reusable",
    originalUrl,
    internalUrl: `/explore/wikipedia/${page.pageid}`,
    textLicense: wikiLicense,
    attribution:
      "Wikipedia contributors · CC BY-SA 4.0 · Unmodified introductory extract",
  };
}
interface ImageInfo {
  descriptionurl?: string;
  extmetadata?: Record<string, { value: string }>;
  thumburl?: string;
  url?: string;
}
export function normalizeCommonsImage(
  info: ImageInfo,
): LicensedImage | undefined {
  const metadata = info.extmetadata ?? {};
  const license = plainText(metadata.LicenseShortName?.value);
  const licenseUrl = metadata.LicenseUrl?.value;
  const src = info.thumburl ?? info.url;
  const fileUrl = info.descriptionurl;
  if (
    !src ||
    !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(src) ||
    !fileUrl ||
    !/^https:\/\/commons\.wikimedia\.org\//.test(fileUrl) ||
    !license ||
    !licenseUrl ||
    !/^https:\/\/(creativecommons.org|www.creativecommons.org)\//.test(
      licenseUrl,
    ) ||
    !/(CC BY|CC0|Public domain)/i.test(license) ||
    metadata.NonFree?.value === "true"
  )
    return undefined;
  const credit =
    plainText(metadata.Artist?.value) ?? plainText(metadata.Credit?.value);
  if (!credit) return undefined;
  const alt = plainText(metadata.ImageDescription?.value);
  return {
    src,
    alt: alt && alt.length <= 350 ? alt : "",
    credit,
    creditUrl: fileUrl,
    license,
    licenseUrl,
    originalFileUrl: fileUrl,
    attribution: credit,
  };
}
const imageForFile = unstable_cache(
  async (filename: string) => {
    const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: "query", format: "json", formatversion: "2", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1600", titles: `File:${filename}` })}`;
    const data = await openApiJson<{
      query?: { pages: { imageinfo?: ImageInfo[] }[] };
    }>(url);
    const info = data.query?.pages[0]?.imageinfo?.[0];
    return info ? (normalizeCommonsImage(info) ?? null) : null;
  },
  ["commons-image-v1"],
  { revalidate: 604800 },
);
const pageParams = {
  prop: "extracts|pageimages|info|pageprops",
  exintro: "1",
  exsentences: "5",
  explaintext: "1",
  piprop: "name|thumbnail",
  pithumbsize: "1200",
  pilicense: "free",
  inprop: "url",
};
export const getWikipediaDiscovery = unstable_cache(
  async (pageId: number): Promise<WikipediaDiscovery | null> => {
    if (!Number.isInteger(pageId) || pageId <= 0 || pageId > 999999999)
      return null;
    const data = await openApiJson<{ query?: { pages: WikiPage[] } }>(
      query({ ...pageParams, pageids: String(pageId) }),
    );
    const page = data.query?.pages[0];
    if (!page) return null;
    const normalized = normalizeWikipedia(page);
    if (!normalized) return null;
    if (page.pageimage) {
      try {
        normalized.image = (await imageForFile(page.pageimage)) ?? undefined;
      } catch {
        /* Text discovery remains useful without a licensed image. */
      }
    }
    return normalized;
  },
  ["wikipedia-page-v1"],
  { revalidate: 86400 },
);
const discoverCandidates = unstable_cache(
  async (seed: string) => {
    // Search actual pages using curated broad categories; no fixed final article list.
    const data = await openApiJson<{ query?: { pages: WikiPage[] } }>(
      query({
        ...pageParams,
        generator: "search",
        gsrsearch: `incategory:"${seed}"`,
        gsrnamespace: "0",
        gsrlimit: "18",
      }),
    );
    let pages = (data.query?.pages ?? []).filter((page) =>
      normalizeWikipedia(page),
    );
    if (!pages.length) {
      const fallback = await openApiJson<{ query?: { pages: WikiPage[] } }>(
        query({
          ...pageParams,
          generator: "search",
          gsrsearch: seed,
          gsrnamespace: "0",
          gsrlimit: "12",
        }),
      );
      pages = (fallback.query?.pages ?? []).filter((page) =>
        normalizeWikipedia(page),
      );
    }
    return pages.map((page) => ({
      pageId: page.pageid,
      hasImage: !!page.pageimage,
    }));
  },
  ["wikipedia-discovery-pool-v1"],
  { revalidate: 86400 },
);
export const getRabbitHole = unstable_cache(
  async (
    date: string,
    interestIds: string[],
    selection: DiscoverySelection = {},
  ) => {
    const key = `${date}:${[...interestIds].sort().join(",")}`;
    const seeds = seededOrder(
      [...new Set(interestIds.flatMap((id) => topicSeeds[id] ?? []))],
      key,
      (seed) => seed,
    ).slice(0, 2);
    const results = await Promise.allSettled(seeds.map(discoverCandidates));
    const candidates = [
      ...new Map(
        results
          .flatMap((result) =>
            result.status === "fulfilled" ? result.value : [],
          )
          .map((page) => [page.pageId, page]),
      ).values(),
    ];
    const identity = (page: { pageId: number }) => `wikipedia:${page.pageId}`;
    const ordered = discoveryOrder(
      candidates,
      key,
      identity,
      selection,
      (page) => Number(page.hasImage),
    );
    for (const page of discoveryAttempts(
      ordered,
      identity,
      selection.recent ?? [],
      3,
    )) {
      try {
        const item = await getWikipediaDiscovery(page.pageId);
        if (item) return item;
      } catch {}
    }
    throw new Error("No usable Wikipedia discovery is available.");
  },
  ["daily-rabbit-hole-v1"],
  { revalidate: 86400 },
);
