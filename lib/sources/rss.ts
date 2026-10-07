import { prepareStoryForDisplay } from "@/lib/content/prepare";
import { publisherPolicy } from "@/lib/content/policies";
import Parser from "rss-parser";
import { convert } from "html-to-text";
import { createHash } from "node:crypto";
import { fetchFeedXml, FeedError, publicLink } from "./safety";
import type { EditorialImage, EditorialStory, Source } from "@/types/editorial";
import { interests } from "@/data/catalog";

type Fields = {
  author?: string;
  description?: string;
  summary?: string;
  mediaContent?: unknown[];
  mediaThumbnail?: unknown[];
  explicitImage?: unknown;
};
export const parser = new Parser<Record<string, never>, Fields>({
  customFields: {
    item: [
      "description",
      "summary",
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["image", "explicitImage"],
    ],
  },
});
export function plainText(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const text = convert(value, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
    ],
  }).trim();
  return text || undefined;
}
function imageField(value: unknown, base: string): string | undefined {
  if (typeof value === "string") return publicLink(value, base);
  if (!value || typeof value !== "object") return undefined;
  const record = value as {
    $?: { url?: string; type?: string; medium?: string };
    url?: string | string[];
  };
  if (record.$?.type && !record.$.type.startsWith("image/")) return undefined;
  if (record.$?.medium && record.$.medium !== "image") return undefined;
  return publicLink(
    record.$?.url ?? (Array.isArray(record.url) ? record.url[0] : record.url),
    base,
  );
}
export function extractImage(
  item: Parser.Item & Fields,
  source: Source,
): EditorialImage | undefined {
  const src = [
    ...(item.mediaContent ?? []),
    ...(item.mediaThumbnail ?? []),
    ...(item.enclosure?.type?.startsWith("image/") ? [item.enclosure.url] : []),
    item.explicitImage,
  ]
    .map((value) => imageField(value, source.feedUrl ?? source.websiteUrl))
    .find(Boolean);
  return src
    ? { src, alt: "", credit: "", creditUrl: source.websiteUrl }
    : undefined;
}
export function normalizeItem(
  item: Parser.Item & Fields,
  source: Source,
): EditorialStory | undefined {
  const title = plainText(item.title);
  const url = publicLink(item.link, source.websiteUrl);
  if (!title || !url) return undefined;
  const tags = (item.categories ?? [])
    .map((tag) => plainText(tag)?.toLowerCase())
    .filter(Boolean);
  const mapped = interests
    .filter((interest) =>
      tags.some(
        (tag) => tag === interest.id || tag === interest.name.toLowerCase(),
      ),
    )
    .map((interest) => interest.id);
  const interestIds = [...new Set([...source.categories, ...mapped])];
  const rawDate = item.isoDate ?? item.pubDate;
  const publishedAt =
    rawDate && Number.isFinite(Date.parse(rawDate))
      ? new Date(rawDate).toISOString()
      : undefined;
  // description/summary only; never use content:encoded or Atom content (article bodies).
  const excerpt = plainText(item.description ?? item.summary);
  return prepareStoryForDisplay(
    {
      id: createHash("sha256").update(url).digest("hex").slice(0, 24),
      title,
      url,
      source,
      sourceType: source.sourceType,
      contentPolicy: "external",
      category:
        interests.find((interest) => interest.id === interestIds[0])?.name ??
        source.name,
      interestIds,
      publishedAt,
      excerpt,
      author: plainText(item.creator ?? item.author),
      image: extractImage(item, source),
    },
    source.contentPolicy,
  );
}
export async function parseFeed(xml: string) {
  try {
    return await parser.parseString(xml);
  } catch {
    throw new FeedError("We couldn’t read this RSS or Atom feed.");
  }
}
export async function readRss(source: Source) {
  if (!source.feedUrl) throw new FeedError("This source has no verified feed.");
  const response = await fetchFeedXml(source.feedUrl);
  const feed = await parseFeed(response.xml);
  return {
    source,
    stories: feed.items
      .slice(0, 60)
      .map((item) => normalizeItem(item, source))
      .filter((story): story is EditorialStory => !!story),
  };
}
export async function validateCustomFeed(input: string): Promise<Source> {
  // Only the known Substack host convention supports publication-to-feed discovery.
  const candidate = new URL(input);
  if (
    candidate.hostname.endsWith(".substack.com") &&
    (candidate.pathname === "/" || candidate.pathname === "")
  )
    candidate.pathname = "/feed";
  const response = await fetchFeedXml(candidate.href);
  const feed = await parseFeed(response.xml);
  if (
    !feed.title ||
    !feed.items.some((item) => item.title && publicLink(item.link))
  )
    throw new FeedError("This feed has no readable stories.");
  const websiteUrl = publicLink(feed.link) ?? response.url;
  return {
    id: `custom:${createHash("sha256").update(response.url).digest("hex").slice(0, 24)}`,
    slug: candidate.hostname,
    name: plainText(feed.title)!,
    websiteUrl,
    feedUrl: response.url,
    sourceType: candidate.hostname.endsWith(".substack.com")
      ? "substack"
      : "rss",
    contentPolicy: publisherPolicy,
    categories: [],
    description: "Verified RSS / Atom feed",
  };
}
