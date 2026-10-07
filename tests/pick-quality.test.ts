import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBook,
  normalizeTmdb,
  normalizeAlbum,
} from "../lib/picks/normalize";
import { isDiscoveryPick } from "../lib/picks/quality";
import { orderedPickTypes, selectCulturalPick } from "../lib/picks/select";
import type { CulturalPick } from "../types/pick";
import type { PickType } from "../lib/picks/model";
const work = {
  key: "/works/OL1W",
  title: "A Book",
  author_name: ["A Writer"],
  language: ["eng"],
};
const book = (id = 1) => normalizeBook({ ...work, key: `/works/OL${id}W` })!;
const film = (id = 1) =>
  normalizeTmdb(
    {
      id,
      title: "A Film",
      original_language: "ja",
      original_title: "映画",
      credits: { crew: [{ job: "Director", name: "International Director" }] },
    },
    "film",
  )!;
const tv = () =>
  normalizeTmdb(
    { id: 1, name: "A Series", created_by: [{ name: "Creator" }] },
    "tv",
  )!;
const album = () =>
  normalizeAlbum({
    id: "12345678-1234-1234-1234-123456789abc",
    title: "An Album",
    "primary-type": "Album",
    "secondary-types": [],
    "artist-credit": [{ name: "Artist" }],
  })!;
const fixtures: Record<PickType, CulturalPick[]> = {
  book: [book(1), book(2)],
  film: [film(1), film(2)],
  tv: [tv()],
  album: [album()],
};
const pool = async (type: PickType) => fixtures[type];
const group = (type: PickType) =>
  type === "film" || type === "tv" ? "screen" : type;
test("English-labelled display editions preserve international literature and stable Work identity", () => {
  const result = normalizeBook({
    ...work,
    title: "Преступление и наказание",
    language: ["rus", "eng"],
    author_name: ["Fyodor Dostoevsky"],
    editions: {
      docs: [
        {
          key: "/books/OL99M",
          title: "Crime and Punishment",
          language: ["eng"],
          cover_i: 42,
        },
      ],
    },
  })!;
  assert.equal(result.title, "Crime and Punishment");
  assert.equal(result.id, "openlibrary:OL1W");
  assert.equal(result.creators[0], "Fyodor Dostoevsky");
  assert.equal(
    result.image?.src,
    "https://covers.openlibrary.org/b/id/42-L.jpg?default=false",
  );
  assert.ok(normalizeBook(work));
});
test("No English display evidence excludes non-English Works, including ambiguous multilingual titles", () => {
  for (const record of [
    { ...work, title: "郭嵩燾等使西記六種", language: ["chi"] },
    { ...work, title: "郭嵩燾等使西記六種", language: ["eng"] },
    { ...work, title: "La mémoire", language: ["fre", "eng"] },
    { ...work, language: undefined },
    {
      ...work,
      editions: {
        docs: [{ title: "English-looking title", language: ["fre"] }],
      },
      language: ["fre"],
    },
  ])
    assert.equal(normalizeBook(record), null);
});
test("TMDB localized display title retains international cinema regardless of original language", () => {
  const localized = normalizeTmdb(
    {
      id: 496243,
      title: "Parasite",
      original_title: "기생충",
      original_language: "ko",
      credits: { crew: [{ job: "Director", name: "Bong Joon-ho" }] },
    },
    "film",
  )!;
  assert.equal(localized.title, "Parasite");
  assert.ok(isDiscoveryPick(localized));
  assert.equal(localized.id, "tmdb:movie:496243");
  assert.equal(
    normalizeTmdb({ id: 2, title: "기생충", original_language: "ko" }, "film"),
    null,
  );
});
test("Discovery rejects placeholders, edition noise and missing meaningful creators, tolerates missing image/year", () => {
  for (const title of [
    "Untitled",
    "ISBN 9781234567890",
    "A Book (Deluxe Edition)",
    "Test",
    " ",
  ])
    assert.equal(normalizeBook({ ...work, title }), null);
  assert.equal(normalizeBook({ ...work, author_name: [] }), null);
  assert.equal(
    normalizeAlbum({
      id: album().providerId,
      title: "Album",
      "primary-type": "Album",
      "secondary-types": [],
      "artist-credit": [],
    }),
    null,
  );
  const sparse = book();
  assert.ok(isDiscoveryPick(sparse));
  assert.equal(sparse.year, undefined);
  assert.equal(sparse.image, undefined);
  assert.ok(!isDiscoveryPick({ ...film(), creators: [] }));
  assert.equal(
    normalizeTmdb(
      { id: 3, title: "Film", credits: { crew: "malformed" } },
      "film",
    )?.creators.length,
    0,
  );
});
test("Type selection precedes provider pools, is deterministic, and does not privilege the largest pool", async () => {
  const interests = ["books", "film", "music"];
  const date = "2026-10-07";
  const types = orderedPickTypes(date, interests);
  assert.deepEqual(types, orderedPickTypes(date, interests.slice().reverse()));
  const calls: PickType[] = [];
  const selected = await selectCulturalPick(
    date,
    interests,
    {},
    {
      pool: async (type) => {
        calls.push(type);
        return type === "book"
          ? Array.from({ length: 300 }, (_, i) => book(i + 1))
          : fixtures[type];
      },
    },
  );
  assert.equal(selected?.mediaType, types[0]);
  assert.deepEqual(calls, [types[0]]);
  const small = await selectCulturalPick(date, interests, {}, { pool });
  assert.equal(group(small!.mediaType), group(selected!.mediaType));
  const firstGroups = new Set(
    Array.from({ length: 30 }, (_, i) =>
      group(
        orderedPickTypes(
          `2026-11-${String(i + 1).padStart(2, "0")}`,
          interests,
        )[0],
      ),
    ),
  );
  assert.deepEqual(firstGroups, new Set(["book", "screen", "album"]));
});
test("Recent cultural types are soft preferences: repeated book history favors screen or album, failure falls back", async () => {
  const interests = ["books", "film", "music"],
    recent = [book(1).id, book(2).id];
  assert.notEqual(
    orderedPickTypes("2026-10-07", interests, { recent })[0],
    "book",
  );
  const result = await selectCulturalPick(
    "2026-10-07",
    interests,
    { recent },
    { pool },
  );
  assert.notEqual(result?.mediaType, "book");
  const fallback = await selectCulturalPick(
    "2026-10-07",
    interests,
    { recent },
    { pool: async (type) => (type === "book" ? [book(3)] : []) },
  );
  assert.equal(fallback?.id, book(3).id);
  const screenRecent = [film(1).id, tv().id];
  assert.ok(
    !["film", "tv"].includes(
      orderedPickTypes("2026-10-07", interests, { recent: screenRecent })[0],
    ),
  );
});
test("Another Pick crosses eligible types and leaves identity hard exclusions intact", async () => {
  const interests = ["books", "film", "music"];
  const first = await selectCulturalPick("2026-10-07", interests, {}, { pool });
  const second = await selectCulturalPick(
    "2026-10-07",
    interests,
    { exclude: [first!.id], recent: [first!.id], counter: 1 },
    { pool },
  );
  const third = await selectCulturalPick(
    "2026-10-07",
    interests,
    { exclude: [second!.id], recent: [first!.id, second!.id], counter: 2 },
    { pool },
  );
  assert.equal(
    new Set([first, second, third].map((p) => group(p!.mediaType))).size,
    3,
  );
  assert.equal(
    await selectCulturalPick(
      "2026-10-07",
      ["music"],
      { exclude: [album().id] },
      { pool },
    ),
    null,
  );
});
test("Duplicate identities cannot weight selection; bad details do not suppress healthy candidates", async () => {
  const baseline = await selectCulturalPick(
    "2026-10-07",
    ["books"],
    {},
    { pool },
  );
  const dup = await selectCulturalPick(
    "2026-10-07",
    ["books"],
    {},
    {
      pool: async (type) =>
        type === "book" ? [book(1), book(1), book(1), book(2)] : fixtures[type],
    },
  );
  assert.equal(dup?.id, baseline?.id);
  let count = 0;
  const recover = await selectCulturalPick(
    "2026-10-07",
    ["books"],
    {},
    {
      pool,
      detail: async (p) => {
        count++;
        if (count === 1) throw new Error("bad record");
        return p;
      },
    },
  );
  assert.ok(recover);
  assert.equal(count, 2);
});
