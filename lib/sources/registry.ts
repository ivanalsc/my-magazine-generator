import { sourceCatalog } from "@/data/catalog";
import type { FeedSource } from "./types";
// Verified endpoints with the production safe fetcher/parser on 2026-10-06.
const configs: Record<string, Partial<FeedSource>> = {
  "rolling-stone": {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 10 usable entries; newest 2026-10-06T20:58:46.000Z.",
    feedUrl: "https://www.rollingstone.com/music/feed/",
    sourceType: "rss",
    categories: ["music"],
  },
  "bandcamp-daily": {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 38 usable entries; newest 2026-10-06T17:01:59.000Z.",
    feedUrl: "https://daily.bandcamp.com/feed",
    sourceType: "rss",
  },
  hyperallergic: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 15 usable entries; newest 2026-10-06T19:56:27.000Z.",
    feedUrl: "https://hyperallergic.com/rss/",
    sourceType: "rss",
  },
  smithsonian: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 10 usable entries; newest 2026-10-06T20:33:52.000Z.",
    feedUrl: "https://www.smithsonianmag.com/rss/latest_articles/",
    sourceType: "rss",
  },
  aeon: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 20 usable entries; newest 2026-10-06T10:00:00.000Z.",
    feedUrl: "https://aeon.co/feed.rss",
    sourceType: "rss",
  },
  stereogum: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 40 usable entries; newest 2026-10-06T20:51:05.000Z.",
    feedUrl: "https://stereogum.com/feed",
    sourceType: "rss",
  },
  pitchfork: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 29 usable entries; newest 2026-10-06T20:26:41.000Z.",
    feedUrl: "https://pitchfork.com/feed/feed-news/rss",
    sourceType: "rss",
  },
  "its-nice-that": {
    enabled: false,
    status: "UNAVAILABLE",
    verification:
      "{'url': 'https://www.itsnicethat.com/rss', 'error': 'Error: Publication returned HTTP 404.'}; {'url': 'https://www.itsnicethat.com/rss.xml', 'error': 'Error: Publication returned HTTP 404.'}; {'url': 'https://www.itsnicethat.com/feed', 'error': 'Error: Publication returned HTTP 404.'}",
  },
  "creative-boom": {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 20 usable entries; newest 2026-10-06T07:00:00.000Z.",
    feedUrl: "https://www.creativeboom.com/feed/",
    sourceType: "rss",
  },
  designboom: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 10 usable entries; newest 2026-10-06T20:35:05.000Z.",
    feedUrl: "https://www.designboom.com/feed/",
    sourceType: "rss",
  },
  "public-domain-review": {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 60 usable entries; newest 2026-10-06T13:00:00.000Z.",
    feedUrl: "https://publicdomainreview.org/rss.xml",
    sourceType: "rss",
  },
  nautilus: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 10 usable entries; newest 2026-10-06T20:00:00.000Z.",
    feedUrl: "https://nautil.us/feed",
    sourceType: "rss",
  },
  archdaily: {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 24 usable entries; newest 2026-10-06T17:00:00.000Z.",
    feedUrl: "https://www.archdaily.com/rss.xml",
    sourceType: "rss",
  },
  "hacker-news": {
    enabled: true,
    status: "ACTIVE",
    verification:
      "2026-10-06: RSS parsed; 30 usable entries; newest 2026-10-06T20:44:29.000Z.",
    feedUrl: "https://news.ycombinator.com/rss",
    sourceType: "rss",
  },
};
export const sourceRegistry: FeedSource[] = sourceCatalog.map((source) => ({
  ...source,
  ...(configs[source.id] ?? {
    enabled: false,
    status: "UNVERIFIED",
    verification: "Native cultural provider; outside the publisher RSS audit.",
  }),
})) as FeedSource[];
export const enabledSources = sourceRegistry.filter(
  (source) => source.enabled && source.status === "ACTIVE",
);
