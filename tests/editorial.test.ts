import { publisherPolicy } from "../lib/content/policies";
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeItem, parseFeed, plainText } from "../lib/sources/rss";
import {
  safeUrl,
  isPublicIp,
  fetchFeedXml,
  assertPublicAddresses,
} from "../lib/sources/safety";
import { deduplicateStories } from "../lib/sources/deduplicate";
import {
  buildMagazineIssue,
  matchesPreferences,
} from "../lib/buildMagazineIssue";
import { getStoriesForSources, resolveSources } from "../lib/sources/aggregate";
import { sourceRegistry } from "../lib/sources/registry";
import { parsePreferences } from "../lib/preferences";
import { parseSaved, savedKey } from "../lib/storage/saved";
import type {
  Source,
  EditorialStory,
  UserMagazinePreferences,
} from "../types/editorial";
const source: Source = {
  id: "fixture",
  name: "Fixture Publisher",
  slug: "fixture",
  websiteUrl: "https://example.com",
  feedUrl: "https://example.com/feed",
  sourceType: "rss",
  contentPolicy: {
    ...publisherPolicy,
    canDisplayExcerpt: true,
    canDisplayImage: true,
  },
  categories: ["music"],
};
const preferences: UserMagazinePreferences = {
  version: 1,
  interests: ["music", "art", "ideas"],
  sources: [],
  customSources: [],
};
function story(id: string, ids = ["music"]): EditorialStory {
  return {
    id,
    title: `Fixture ${id}`,
    url: `https://example.com/${id}`,
    source,
    sourceType: "rss",
    contentPolicy: "external",
    category: "Music",
    interestIds: ids,
    publishedAt: "2026-10-05T12:00:00Z",
  };
}
test("RSS retains supplied metadata, strips unsafe HTML, ignores bodies and missing fields", async () => {
  const feed = await parseFeed(
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Fixture</title><item><title>Exact &amp; original</title><link>https://example.com/a</link><description><![CDATA[<p>Source <b>description</b>.</p><script>bad()</script>]]></description><content:encoded><![CDATA[Full article body]]></content:encoded></item></channel></rss>',
  );
  const normalized = normalizeItem(feed.items[0], source)!;
  assert.equal(normalized.title, "Exact & original");
  assert.equal(normalized.excerpt, "Source description.");
  assert.equal(normalized.author, undefined);
  assert.equal(normalized.readingTime, undefined);
  assert.equal(normalized.publishedAt, undefined);
  assert.equal(normalized.image, undefined);
  assert.equal(JSON.stringify(normalized).includes("Full article body"), false);
  assert.equal(
    plainText('<a href="javascript:alert(1)">Original words</a>'),
    "Original words",
  );
});
test("Atom summary is metadata; content is not an excerpt", async () => {
  const feed = await parseFeed(
    '<feed xmlns="http://www.w3.org/2005/Atom"><title>Fixture</title><entry><title>Atom title</title><link href="https://example.com/atom"/><summary type="html">Source summary</summary><content>Article body</content><author><name>Real Author</name></author></entry></feed>',
  );
  const item = normalizeItem(feed.items[0], source)!;
  assert.equal(item.excerpt, "Source summary");
  assert.equal(item.author, "Real Author");
  assert.equal(JSON.stringify(item).includes("Article body"), false);
});
test("images come from explicit feed image fields; unsafe and non-image enclosures are ignored", () => {
  assert.equal(
    normalizeItem(
      {
        title: "Title",
        link: "https://example.com/a",
        enclosure: { url: "https://example.com/a.mp3", type: "audio/mpeg" },
      },
      source,
    )?.image,
    undefined,
  );
  assert.equal(
    normalizeItem(
      {
        title: "Title",
        link: "https://example.com/a",
        mediaThumbnail: [{ $: { url: "https://example.com/image.jpg" } }],
      },
      source,
    )?.image?.src,
    "https://example.com/image.jpg",
  );
  assert.equal(
    normalizeItem({ title: "Title", link: "javascript:alert(1)" }, source),
    undefined,
  );
});
test("URL safety rejects private, unusual numeric IPs, metadata, credentials and unsafe schemes", async () => {
  for (const url of [
    "http://localhost/feed",
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://169.254.169.254",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://metadata.google.internal",
    "http://host.internal",
    "ftp://example.com",
    "https://user:pass@example.com",
    "http://example.com:8080",
    "http://192.0.0.170",
  ])
    assert.throws(() => safeUrl(url), url);
  for (const ip of [
    "100.64.0.1",
    "198.18.0.1",
    "192.0.0.9",
    "192.88.99.1",
    "2001:db8::1",
    "2001:0db8:0000:0000:0000:0000:0000:0001",
    "2001:0000::1",
    "3fff::1",
    "fc00::1",
    "fe80::1",
  ])
    assert.equal(isPublicIp(ip), false, ip);
  assert.equal(isPublicIp("192.0.66.114"), true);
  assert.equal(isPublicIp("8.8.8.8"), true);
  await assert.rejects(fetchFeedXml("http://127.0.0.1/feed"));
  assert.throws(() =>
    assertPublicAddresses([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  );
  assert.throws(() => assertPublicAddresses([]));
  assert.doesNotThrow(() =>
    assertPublicAddresses([{ address: "192.0.66.114", family: 4 }]),
  );
});
test("deduplication uses original URL without tracking and deterministic order", () => {
  const first = story("a"),
    second = {
      ...story("b"),
      url: "https://www.example.com/a/?utm_source=test#fragment",
    };
  assert.equal(deduplicateStories([second, first]).length, 1);
  assert.deepEqual(
    deduplicateStories([second, first]),
    deduplicateStories([first, second]),
  );
});
test("builder is stable across input ordering, finite, and outside is genuinely unmatched", () => {
  const stories = Array.from({ length: 40 }, (_, i) =>
    story(String(i), [i % 3 === 0 ? "music" : i % 3 === 1 ? "art" : "ideas"]),
  );
  const outside = {
    ...story("outside", ["nature"]),
    source: { ...source, id: "nature" },
  };
  const issue = buildMagazineIssue({
    preferences,
    stories: [...stories, outside],
    date: "2026-10-06",
  });
  assert.deepEqual(
    issue,
    buildMagazineIssue({
      preferences,
      stories: [outside, ...stories.reverse()],
      date: "2026-10-06",
    }),
  );
  assert.ok(issue.stories.length + issue.culturalItems.length <= 18);
  assert.equal(
    issue.sections.find((s) => s.id === "outside")?.storyIds[0],
    "outside",
  );
  assert.equal(
    new Set(issue.stories.map((s) => s.id)).size,
    issue.stories.length,
  );
  assert.equal(
    buildMagazineIssue({
      preferences,
      stories,
      date: "2026-10-06",
    }).sections.some((s) => s.id === "outside"),
    false,
  );
  assert.equal(
    buildMagazineIssue({
      preferences,
      stories,
      date: "2026-10-07",
    }).culturalItems.some((i) => i.kind === "history"),
    false,
  );
});
test("explicit source choices, topic matching and unconnected providers", () => {
  assert.equal(matchesPreferences(story("a"), preferences), true);
  const choice = { ...preferences, sources: ["rolling-stone"] };
  const resolved = resolveSources(choice);
  assert.equal(
    resolved.some((s) => s.id === "rolling-stone"),
    true,
  );
  assert.equal(
    resolved.some((s) => s.id === "its-nice-that"),
    false,
  );
  assert.equal(sourceRegistry.filter((s) => s.enabled).length, 13);
  assert.ok(
    sourceRegistry
      .filter((s) => s.enabled)
      .every((s) => s.status === "ACTIVE" && s.feedUrl),
  );
});
test("a failed provider does not erase other sources", async () => {
  const result = await getStoriesForSources(
    [source, { ...source, id: "broken" }],
    async (s) => {
      if (s.id === "broken") throw new Error("fixture failure");
      return { source: s, stories: [story("a")] };
    },
  );
  assert.equal(result.stories.length, 1);
  assert.equal(result.failed.length, 1);
  assert.deepEqual(result.loaded, ["fixture"]);
});
test("preferences keep verified custom feed metadata; invalid storage recovers", () => {
  const parsed = parsePreferences(
    JSON.stringify({
      ...preferences,
      customSources: [{ ...source, id: "custom:fixture", name: "Feed title" }],
    }),
  );
  assert.equal(parsed?.customSources[0].feedUrl, source.feedUrl);
  assert.equal(parsed?.customSources[0].name, "Feed title");
  assert.equal(parsePreferences("{broken"), null);
});
test("Saved metadata survives issue changes and rejects malformed local entries", () => {
  const item = story("kept");
  const record = {
    version: 1,
    items: [
      {
        kind: "story",
        key: savedKey(item),
        savedAt: "2026-10-06T12:00:00Z",
        item,
      },
    ],
  };
  assert.equal(parseSaved(JSON.stringify(record))[0].item.title, item.title);
  assert.equal(parseSaved("{broken").length, 0);
  assert.equal(
    parseSaved(
      JSON.stringify({
        ...record,
        items: [
          {
            ...record.items[0],
            item: { ...item, source: { name: { bad: true } } },
          },
        ],
      }),
    ).length,
    0,
  );
  assert.equal(
    parseSaved(
      JSON.stringify({
        ...record,
        items: [
          { ...record.items[0], item: { ...item, url: "javascript:alert(1)" } },
        ],
      }),
    ).length,
    0,
  );
});
