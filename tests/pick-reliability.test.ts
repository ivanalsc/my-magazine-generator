import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAlbum, normalizeBook } from "../lib/picks/normalize";
import {
  loadBookPool,
  orderedBookSubjects,
  MAX_BOOK_SUBJECT_ATTEMPTS,
} from "../lib/picks/books";
import {
  PickHttpError,
  formatPickDiagnostic,
  safePickFailure,
  type PickDiagnostic,
} from "../lib/picks/diagnostics";
import { orderedPickTypes, selectCulturalPick } from "../lib/picks/select";
import { buildMagazineIssue } from "../lib/buildMagazineIssue";
const interests = ["art", "design", "music", "travel"];
// Actual observed MusicBrainz search shape: absent secondary-types, valid Album.
const search = {
  id: "0fc418e6-dfc4-3934-9d26-de641a693198",
  title: "This Sentence Is True (The Previous Sentence Is False)",
  "primary-type": "Album",
  "artist-credit": [
    { name: "Sheila Chandra", artist: { name: "Sheila Chandra" } },
  ],
};
const book = () =>
  normalizeBook({
    key: "/works/OL1W",
    title: "An English Book",
    language: ["eng"],
    author_name: ["A Writer"],
  })!;
test("Observed MusicBrainz search omission and detail empty array normalize to the same Album", () => {
  const a = normalizeAlbum(search, "search")!,
    b = normalizeAlbum({ ...search, "secondary-types": [] }, "detail")!;
  assert.ok(a);
  assert.ok(b);
  assert.deepEqual(
    { ...a, provenance: { ...a.provenance, fetchedAt: "same" } },
    { ...b, provenance: { ...b.provenance, fetchedAt: "same" } },
  );
  assert.equal(normalizeAlbum(search, "detail"), null);
});
test("MusicBrainz accepts only genuine omission in search, rejects present malformed fields and noisy types", () => {
  for (const shape of ["search", "detail"] as const) {
    for (const secondary of [undefined, null, "", {}, [null], [123], [{}]])
      assert.equal(
        normalizeAlbum({ ...search, "secondary-types": secondary }, shape),
        null,
      );
    for (const secondary of [
      "Compilation",
      "Interview",
      "DJ-mix",
      "Mixtape/Street",
      "Broadcast",
    ])
      assert.equal(
        normalizeAlbum({ ...search, "secondary-types": [secondary] }, shape),
        null,
      );
    for (const primary of ["Single", "EP", "Broadcast", "Interview", "Other"])
      assert.equal(
        normalizeAlbum({ ...search, "primary-type": primary }, shape),
        null,
      );
  }
});
test("Open Library subjects retain existing seeded ordering, deduplicate interests and cap at three", () => {
  assert.deepEqual(orderedBookSubjects(interests), ["travel", "design", "art"]);
  assert.deepEqual(
    orderedBookSubjects(interests.slice().reverse()),
    orderedBookSubjects(interests),
  );
  assert.deepEqual(
    orderedBookSubjects([...interests, "travel"]),
    orderedBookSubjects(interests),
  );
  assert.equal(MAX_BOOK_SUBJECT_ATTEMPTS, 3);
});
test("Open Library timeout falls through sequentially to the next subject and stops on success", async () => {
  const calls: string[] = [],
    events: PickDiagnostic[] = [];
  let inFlight = 0;
  const picks = await loadBookPool(
    interests,
    async (subject) => {
      assert.equal(inFlight, 0);
      inFlight++;
      calls.push(subject);
      await Promise.resolve();
      inFlight--;
      if (subject === "travel")
        throw new DOMException("sensitive raw text", "TimeoutError");
      return [book()];
    },
    (e) => events.push(e),
  );
  assert.deepEqual(calls, ["travel", "design"]);
  assert.equal(picks.length, 1);
  assert.deepEqual(picks[0].interestIds, ["design"]);
  assert.match(
    formatPickDiagnostic("book", events[0]),
    /subject=travel → timeout/,
  );
  assert.match(
    formatPickDiagnostic("book", events[1]),
    /subject=design → success, 1 candidates/,
  );
});
test("Open Library empty or invalid normalized pool falls through without eager extra requests", async () => {
  for (const first of [[], [{ ...book(), creators: [] }]]) {
    const calls: string[] = [];
    const events: PickDiagnostic[] = [];
    const result = await loadBookPool(
      interests,
      async (subject) => {
        calls.push(subject);
        return subject === "travel" ? first : [book()];
      },
      (e) => events.push(e),
    );
    assert.deepEqual(calls, ["travel", "design"]);
    assert.equal(result.length, 1);
    assert.match(
      formatPickDiagnostic("book", events[0]),
      /0 normalized candidates/,
    );
  }
});
test("Open Library exhausts at most three subjects on empty responses or failures", async () => {
  for (const fail of [false, true]) {
    const calls: string[] = [];
    const result = await loadBookPool(
      interests,
      async (subject) => {
        calls.push(subject);
        if (fail) throw new PickHttpError(503);
        return [];
      },
      () => {},
    );
    assert.deepEqual(calls, ["travel", "design", "art"]);
    assert.deepEqual(result, []);
  }
});
test("Provider errors distinguish HTTP status/timeout and never log raw sensitive data", () => {
  assert.equal(safePickFailure(new PickHttpError(503)), "HTTP 503 (5xx)");
  assert.equal(
    safePickFailure(new DOMException("secret", "TimeoutError")),
    "timeout",
  );
  const secret = "email@example.com bearer SECRET https://private.example/path";
  assert.equal(safePickFailure(new Error(secret)), "provider/network error");
  const msg = formatPickDiagnostic("book", {
    subject: secret,
    outcome: "failure",
    reason: secret,
  });
  assert.equal(msg, "[cultural-pick] book → provider/network error");
});
test("Art/Design/Music/Travel: healthy observed MusicBrainz search produces an Album without querying other types", async () => {
  const calls: string[] = [];
  const result = await selectCulturalPick(
    "2026-10-07",
    interests,
    {},
    {
      pool: async (type) => {
        calls.push(type);
        return type === "album" ? [normalizeAlbum(search, "search")!] : [];
      },
    },
  );
  assert.deepEqual(orderedPickTypes("2026-10-07", interests), [
    "album",
    "film",
    "book",
  ]);
  assert.deepEqual(calls, ["album"]);
  assert.equal(result?.mediaType, "album");
});
test("MusicBrainz 503 → TMDB unavailable → Travel failure → Design success still produces a Book", async () => {
  const execution: string[] = [];
  const result = await selectCulturalPick(
    "2026-10-07",
    interests,
    {},
    {
      pool: async (type) => {
        execution.push(type);
        if (type === "album") throw new PickHttpError(503);
        if (type === "film") return [];
        return loadBookPool(
          interests,
          async (subject) => {
            execution.push(subject);
            if (subject === "travel")
              throw new DOMException("timeout", "TimeoutError");
            return [book()];
          },
          () => {},
        );
      },
    },
  );
  assert.deepEqual(execution, ["album", "film", "book", "travel", "design"]);
  assert.equal(result?.mediaType, "book");
  assert.deepEqual(result?.interestIds, ["design"]);
});
test("Exhausted cultural paths return null while the finite magazine remains constructible", async () => {
  const result = await selectCulturalPick(
    "2026-10-07",
    interests,
    {},
    {
      pool: async (type) =>
        type === "book"
          ? loadBookPool(
              interests,
              async () => {
                throw new PickHttpError(503);
              },
              () => {},
            )
          : Promise.reject(new PickHttpError(503)),
    },
  );
  assert.equal(result, null);
  const issue = buildMagazineIssue({
    date: "2026-10-07",
    preferences: { version: 1, interests, sources: [], customSources: [] },
    stories: [],
  });
  assert.ok(issue);
  assert.ok(!issue.culturalItems.some((i) => i.kind === "cultural-pick"));
});
