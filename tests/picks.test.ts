import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import {
  normalizeTmdb,
  normalizeBook,
  normalizeAlbum,
} from "../lib/picks/normalize";
import { eligibleTypes, validPick } from "../lib/picks/model";
import { selectCulturalPick } from "../lib/picks/select";
import { createRequestQueue, CACHE_SECONDS } from "../lib/picks/request";
import { savedKey } from "../lib/storage/saved-parser";
import { toggleSaved } from "../lib/storage/saved";
import {
  hydrateAccount,
  AccountStateContext,
} from "../lib/repositories/account-store";
import { makeSavedEntry } from "../lib/repositories/supabase";
import {
  serializeIssue,
  reconstructIssue,
} from "../lib/repositories/composition";
import { parseGuestIssue } from "../lib/editorial/guest";
import { buildMagazineIssue } from "../lib/buildMagazineIssue";
import { CulturalPickFeature } from "../components/editorial/CulturalPickFeature";
import { SaveButton } from "../components/saved/SaveButton";
import { TmdbCredit } from "../components/editorial/TmdbCredit";
import type { CulturalPick } from "../types/pick";
const preferences = {
  version: 1 as const,
  interests: ["music", "art", "design"],
  sources: [],
  customSources: [],
};
const film = (id = 1) =>
  normalizeTmdb(
    {
      id,
      title: `Film ${id}`,
      release_date: "2023-01-01",
      poster_path: `/${id}.jpg`,
      genres: [{ name: "Drama" }],
      credits: { crew: [{ job: "Director", name: "A Director" }] },
    },
    "film",
  )!;
const book = (id = 1) =>
  normalizeBook({
    key: `/works/OL${id}W`,
    title: `Book ${id}`,
    author_name: ["A Writer"],
    language: ["eng"],
    first_publish_year: 1963,
    cover_i: id,
    subject: ["Art"],
  })!;
const mbid = "12345678-1234-1234-1234-123456789abc";
const album = () =>
  normalizeAlbum({
    id: mbid,
    title: "An album",
    "primary-type": "Album",
    "secondary-types": [],
    "first-release-date": "2021-03-26",
    "artist-credit": [{ name: "First Artist" }, { name: "Second Artist" }],
  })!;
test("TMDB preserves factual credits, distinguishes movie/tv identity and drops unsafe posters", () => {
  assert.equal(film().id, "tmdb:movie:1");
  assert.deepEqual(film().creators, ["A Director"]);
  assert.equal(film().year, "2023");
  assert.equal(film().image!.src, "https://image.tmdb.org/t/p/w500/1.jpg");
  const tv = normalizeTmdb(
    { id: 1, name: "Series", created_by: [{ name: "Creator" }] },
    "tv",
  )!;
  assert.equal(tv.id, "tmdb:tv:1");
  assert.notEqual(savedKey(tv), savedKey(film()));
  assert.equal(tv.year, undefined);
  assert.equal(
    normalizeTmdb({ id: 1, title: "Adult", adult: true }, "film"),
    null,
  );
  assert.equal(
    normalizeTmdb({ id: 1, title: "Safe", poster_path: "//evil.org/x" }, "film")
      ?.image,
    undefined,
  );
  assert.ok(!validPick({ ...film(), id: "tmdb:movie:2" }));
  assert.ok(
    !validPick({
      ...film(),
      provenance: { ...film().provenance, expiresAt: "invalid" },
    }),
  );
});
test("Open Library uses work identity, links back and accepts missing cover/year with verified language and author", () => {
  assert.equal(book().id, "openlibrary:OL1W");
  assert.equal(book().originalUrl, "https://openlibrary.org/works/OL1W");
  assert.ok(book().image!.src.startsWith("https://covers.openlibrary.org/"));
  const sparse = normalizeBook({
    key: "/works/OL2W",
    title: "A book",
    author_name: ["A Writer"],
    language: ["eng"],
  })!;
  assert.ok(sparse);
  assert.equal(sparse.image, undefined);
  assert.deepEqual(sparse.creators, ["A Writer"]);
  assert.equal(sparse.year, undefined);
  assert.equal(normalizeBook({ key: "/books/OL1M", title: "Edition" }), null);
});
test("MusicBrainz selects actual release-group albums; cover and excluded secondary types never pass", () => {
  assert.equal(album().id, `musicbrainz:${mbid}`);
  assert.equal(album().image, undefined);
  assert.equal(album().primaryType, "Album");
  for (const type of ["Single", "EP", "Broadcast"])
    assert.equal(
      normalizeAlbum({
        id: mbid,
        title: "Other",
        "primary-type": type,
        "secondary-types": [],
      }),
      null,
    );
  for (const type of ["Compilation", "Interview", "Broadcast"])
    assert.equal(
      normalizeAlbum({
        id: mbid,
        title: "Other",
        "primary-type": "Album",
        "secondary-types": [type],
      }),
      null,
    );
  assert.ok(!validPick({ ...album(), image: film().image }));
});
test("Cultural Pick eligibility, deterministic ordering and provider failure keep a single discovery", async () => {
  assert.ok(eligibleTypes(["music"]).includes("album"));
  assert.ok(eligibleTypes(["film"]).includes("tv"));
  assert.ok(eligibleTypes(["books"]).includes("book"));
  const pool = async () => [book(1), book(2), book(3)];
  const options = { pool };
  const ids = ["books", "history", "psychology"];
  const first = await selectCulturalPick("2026-10-07", ids, {}, options);
  const reordered = await selectCulturalPick(
    "2026-10-07",
    ids.slice().reverse(),
    {},
    { pool: async () => (await pool()).reverse() },
  );
  assert.equal(first!.id, reordered!.id);
  const second = await selectCulturalPick(
    "2026-10-07",
    ids,
    { exclude: [first!.id], recent: [first!.id], counter: 1 },
    options,
  );
  const third = await selectCulturalPick(
    "2026-10-07",
    ids,
    { exclude: [second!.id], recent: [first!.id, second!.id], counter: 2 },
    options,
  );
  assert.equal(new Set([first!.id, second!.id, third!.id]).size, 3);
  assert.equal(
    await selectCulturalPick(
      "2026-10-07",
      ids,
      {},
      {
        pool: async () => {
          throw new Error("timeout");
        },
      },
    ),
    null,
  );
  const fallback = await selectCulturalPick(
    "2026-10-07",
    ids,
    {},
    {
      pool: async (type) => {
        if (type === "book") throw new Error("429");
        return [film()];
      },
    },
  );
  assert.equal(fallback?.mediaType, "film");
});
test("MusicBrainz queue spaces failed and concurrent work and caches remain bounded", async () => {
  let time = 0;
  const starts: number[] = [];
  const queue = createRequestQueue(
    1100,
    () => time,
    async (ms) => {
      time += ms;
    },
  );
  await Promise.allSettled([
    queue(async () => {
      starts.push(time);
      throw new Error("429");
    }),
    queue(async () => {
      starts.push(time);
      return 1;
    }),
    queue(async () => {
      starts.push(time);
      return 2;
    }),
  ]);
  assert.deepEqual(starts, [0, 1100, 2200]);
  assert.ok(CACHE_SECONDS.tmdb < 150 * 86400);
});
test("pick guest revision / Archive snapshots retain identity and book metadata without inventing album imagery", () => {
  const issue = buildMagazineIssue({
    preferences,
    stories: [],
    date: "2026-10-07",
  });
  issue.culturalItems = [book()];
  const envelope = {
    issue,
    preferences,
    fallback: false,
    partial: false,
    loadedCount: 0,
    revision: 1,
  };
  assert.equal(parseGuestIssue(envelope)!.issue.culturalItems[0].id, book().id);
  const serialized = serializeIssue(envelope);
  assert.equal(serialized.entries[0].type, "book");
  assert.equal(serialized.entries[0].externalId, "OL1W");
  const archive = reconstructIssue(
    {
      id: issue.id,
      issue_date: issue.date,
      issue_number: 1,
      created_at: issue.date,
      preferences_snapshot: preferences,
      composition: serialized.composition,
    },
    serialized.entries.map((e) => ({
      position: e.position,
      item_type: e.type,
      snapshot: e.snapshot,
    })),
  );
  assert.equal(archive.issue.culturalItems[0].image!.src, book().image!.src);
  issue.culturalItems = [film()];
  const ref = serializeIssue({ ...envelope, issue }).entries[0]
    .snapshot as Record<string, unknown>;
  assert.equal(ref.id, "tmdb:movie:1");
  assert.equal(ref.title, undefined);
  assert.equal(ref.image, undefined);
  for (const item of [book(), album(), film()])
    assert.equal(makeSavedEntry(item)?.key, savedKey(item));
});
test("guest Save does not write local storage; library and sign-in explain account ownership", async () => {
  hydrateAccount({ mode: "guest" });
  assert.match((await toggleSaved(book()))!, /Sign in/);
  const html = renderToStaticMarkup(
    createElement(
      AccountStateContext.Provider,
      { value: { mode: "guest" } },
      createElement(SaveButton, { item: book() }),
    ),
  );
  assert.ok(html.includes("Save"));
  assert.ok(!html.includes("disabled"));
});
test("TMDB credit is unmodified and album/book-without-cover layouts contain no placeholder", () => {
  const credit = renderToStaticMarkup(createElement(TmdbCredit));
  assert.ok(
    credit.includes(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    ),
  );
  assert.ok(credit.includes("www.themoviedb.org/assets/"));
  for (const item of [
    album(),
    normalizeBook({
      key: "/works/OL2W",
      title: "A book",
      author_name: ["A Writer"],
      language: ["eng"],
    })!,
  ]) {
    const html = renderToStaticMarkup(
      createElement(CulturalPickFeature, { item }),
    );
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("pick-text"));
  }
});
test("new migrations protect cultural Saved, immutable revisions, TMDB references and global reservations", async () => {
  const db = new PGlite();
  try {
    const owner = "00000000-0000-4000-8000-000000000001",
      other = "00000000-0000-4000-8000-000000000002";
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${owner}'),('${other}');`,
    );
    for (const name of [
      "202610060001_library.sql",
      "202610060002_issue_revisions.sql",
      "202610070003_cultural_picks.sql",
      "202610070004_tmdb_references.sql",
    ])
      await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}';`,
    );
    for (const item of [book(), album(), film()])
      await db.query(
        "insert into saved_items(user_id,item_key,item_type,snapshot) values($1,$2,$3,$4::jsonb)",
        [owner, savedKey(item), item.mediaType, JSON.stringify(item)],
      );
    const saved = (
      await db.query<{ snapshot: Record<string, unknown> }>(
        "select snapshot from saved_items where item_type='film'",
      )
    ).rows[0].snapshot;
    assert.equal(saved.pointerOnly, true);
    assert.equal(saved.title, undefined);
    assert.equal(saved.image, undefined);
    await assert.rejects(
      db.query(
        "insert into saved_items(user_id,item_key,item_type,snapshot) values($1,'bad','album',$2::jsonb)",
        [owner, JSON.stringify({ ...album(), image: film().image })],
      ),
      /metadata only/,
    );
    await assert.rejects(
      db.query("select merge_guest_library(null,'[]')"),
      /permission denied/,
    );
    const date = (
      await db.query<{ date: string }>(
        "select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text date",
      )
    ).rows[0].date;
    const issue = buildMagazineIssue({ preferences, stories: [], date });
    issue.culturalItems = [book(1)];
    const snapshot = serializeIssue({
      issue,
      preferences,
      fallback: false,
      partial: false,
      loadedCount: 0,
    });
    const id = (
      await db.query<{ id: string }>(
        "select create_magazine_issue($1::date,$2::jsonb,$3::jsonb,$4::jsonb) id",
        [
          date,
          JSON.stringify(preferences),
          JSON.stringify(snapshot.composition),
          JSON.stringify(snapshot.entries),
        ],
      )
    ).rows[0].id;
    issue.culturalItems = [book(2)];
    const replacement = serializeIssue({
      issue,
      preferences,
      fallback: false,
      partial: false,
      loadedCount: 0,
    });
    await db.query(
      "select revise_magazine_issue($1::uuid,0,'cultural-pick',$2::jsonb,$3::jsonb)",
      [
        id,
        JSON.stringify(replacement.composition),
        JSON.stringify(replacement.entries),
      ],
    );
    const latest = (
      await db.query<{ entries: { snapshot: CulturalPick }[] }>(
        "select entries from magazine_issue_revisions",
      )
    ).rows[0];
    assert.equal(latest.entries[0].snapshot.id, book(2).id);
    const base = (
      await db.query<{ snapshot: CulturalPick }>(
        "select snapshot from magazine_issue_items",
      )
    ).rows[0];
    assert.equal(base.snapshot.id, book(1).id);
    const slots = await Promise.all([
      db.query<{ delay: number }>("select reserve_musicbrainz_request() delay"),
      db.query<{ delay: number }>("select reserve_musicbrainz_request() delay"),
    ]);
    assert.ok(slots[1].rows[0].delay >= 1000);
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal((await db.query("select * from saved_items")).rows.length, 0);
    assert.equal(
      (await db.query("select * from magazine_issue_revisions")).rows.length,
      0,
    );
    await assert.rejects(
      db.exec("select * from cultural_provider_limits"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
