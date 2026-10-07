import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWikipedia,
  normalizeCommonsImage,
} from "../lib/sources/wikipedia";
import { normalizeMetObject } from "../lib/sources/met";
import { selectHistoricalEvents } from "../lib/sources/wikimedia";
import { seededOrder } from "../lib/sources/selection";
import { buildMagazineIssue } from "../lib/buildMagazineIssue";
import { parseSaved, savedKey } from "../lib/storage/saved";
import { getCulturalContent } from "../lib/sources/cultural";
const page = {
  pageid: 123,
  ns: 0,
  title: "Fixture subject",
  extract: "Source-provided introductory text. ".repeat(10),
  lastrevid: 456,
};
const object = {
  objectID: 123,
  isPublicDomain: true,
  title: "Fixture painting",
  primaryImage: "https://images.metmuseum.org/CRDImages/ep/original/test.jpg",
  medium: "Oil on canvas",
  department: "European Paintings",
  objectDate: "1900",
};
test("Wikipedia retains source intro, rejects lists, disambiguation and stubs", () => {
  const item = normalizeWikipedia(page)!;
  assert.equal(item.extract, page.extract);
  assert.equal(item.internalUrl, "/explore/wikipedia/123");
  assert.equal(item.textLicense.name, "CC BY-SA 4.0");
  for (const bad of [
    { ...page, pageprops: { disambiguation: "" } },
    { ...page, title: "List of fixtures" },
    { ...page, extract: "Stub" },
    { ...page, ns: 4 },
  ])
    assert.equal(normalizeWikipedia(bad), undefined);
});
test("Commons images require verifiable reusable license and attribution", () => {
  const info = {
    thumburl: "https://upload.wikimedia.org/test.jpg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:Test.jpg",
    extmetadata: {
      Artist: { value: "<b>Source artist</b>" },
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
    },
  };
  assert.equal(normalizeCommonsImage(info)?.credit, "Source artist");
  assert.equal(normalizeCommonsImage({ ...info, extmetadata: {} }), undefined);
  assert.equal(
    normalizeCommonsImage({
      ...info,
      extmetadata: { ...info.extmetadata, NonFree: { value: "true" } },
    }),
    undefined,
  );
});
test("Met rechecks public-domain status, primary image and metadata", () => {
  const item = normalizeMetObject(object)!;
  assert.equal(item.isPublicDomain, true);
  assert.equal(item.medium, "Oil on canvas");
  assert.equal(item.image?.alt, "");
  assert.equal(item.artist, undefined);
  for (const bad of [
    { ...object, isPublicDomain: false },
    { ...object, primaryImage: "" },
    { ...object, medium: "" },
    { ...object, title: "Untitled" },
  ])
    assert.equal(normalizeMetObject(bad), undefined);
});
test("seeded selection is stable for input order and changes with seed", () => {
  const ids = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(
    seededOrder(ids, "2026-10-06", String),
    seededOrder(ids.reverse(), "2026-10-06", String),
  );
  assert.notDeepEqual(
    seededOrder(ids, "2026-10-06", String),
    seededOrder(ids, "2026-10-07", String),
  );
});
test("On This Day is bounded, stable and removes duplicate/long events", () => {
  const events = Array.from({ length: 10 }, (_, i) => ({
    year: 1900 + i,
    text: `Source event ${i} with useful factual context.`,
    pages: [{ pageid: i + 1, title: "Fixture", description: "artist" }],
  }));
  const result = selectHistoricalEvents(
    [...events, events[0], { ...events[0], text: "x".repeat(900) }],
    "2026-10-06",
  );
  assert.equal(result.length, 3);
  assert.deepEqual(
    result,
    selectHistoricalEvents(events.reverse(), "2026-10-06"),
  );
});
test("builder omits missing cultural modules and caps supplied events", () => {
  const preferences = {
    version: 1 as const,
    interests: ["art", "design", "history"],
    sources: [],
    customSources: [],
  };
  const empty = buildMagazineIssue({
    preferences,
    stories: [],
    date: "2026-10-06",
  });
  assert.equal(empty.culturalItems.length, 0);
  assert.deepEqual(empty.onThisDay, []);
  const issue = buildMagazineIssue({
    preferences,
    stories: [],
    date: "2026-10-06",
    culturalContent: {
      rabbitHole: normalizeWikipedia(page),
      artwork: normalizeMetObject(object),
      events: [],
    },
  });
  assert.equal(issue.culturalItems.length, 2);
});
test("Saved recognizes separate Wikipedia/artwork snapshots and migrates v1 without loss", () => {
  const wiki = normalizeWikipedia(page)!,
    art = normalizeMetObject(object)!;
  const items = [
    {
      kind: "wikipediaDiscovery",
      item: wiki,
      key: savedKey(wiki),
      savedAt: "2026-10-06T12:00:00Z",
    },
    {
      kind: "artwork",
      item: art,
      key: savedKey(art),
      savedAt: "2026-10-06T12:00:00Z",
    },
  ];
  assert.deepEqual(
    parseSaved(JSON.stringify({ version: 2, items })).map((item) => item.kind),
    ["wikipediaDiscovery", "artwork"],
  );
  assert.equal(
    parseSaved(
      JSON.stringify({
        version: 1,
        items: [
          {
            ...items[0],
            kind: "cultural",
            item: { ...wiki, internalUrl: "/discover/voynich" },
          },
        ],
      }),
    )[0].kind,
    "legacyCultural",
  );
});
test("a failed cultural provider leaves other discoveries usable", async () => {
  const result = await getCulturalContent("2026-10-06", ["art"], {
    rabbitHole: async () => {
      throw new Error("fixture provider failure");
    },
    artwork: async () => normalizeMetObject(object)!,
    onThisDay: async () => [],
  });
  assert.equal(result.content.rabbitHole, undefined);
  assert.equal(result.content.artwork?.objectId, object.objectID);
  assert.deepEqual(result.content.events, []);
  assert.ok(result.failed.includes("wikipedia"));
});
