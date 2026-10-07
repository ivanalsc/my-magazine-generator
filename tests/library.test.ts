import { repositoryRequest } from "../lib/repositories/http";
import { sameOrigin, publicRequestUrl } from "../lib/http/origin";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { prepareStoryForDisplay } from "../lib/content/prepare";
import { publisherPolicy } from "../lib/content/policies";
import { parseSaved } from "../lib/storage/saved-parser";
import { mergePreferences, mergeSaved } from "../lib/repositories/models";
import {
  serializeIssue,
  reconstructIssue,
} from "../lib/repositories/composition";
import {
  SupabaseLibraryRepository,
  makeSavedEntry,
} from "../lib/repositories/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EditorialStory,
  UserMagazinePreferences,
} from "../types/editorial";
const prefs: UserMagazinePreferences = {
  version: 1,
  interests: ["art", "music", "history"],
  sources: ["hyperallergic"],
  customSources: [],
};
const story: EditorialStory = {
  id: "a",
  title: "Original title",
  url: "https://publisher.example/a",
  source: {
    id: "unknown",
    slug: "unknown",
    name: "Unknown",
    sourceType: "rss",
    websiteUrl: "https://publisher.example",
    categories: ["art"],
    contentPolicy: {
      ...publisherPolicy,
      canDisplayFullText: true,
      canDisplayImage: true,
      canDisplayExcerpt: true,
    },
  },
  sourceType: "rss",
  contentPolicy: "external",
  category: "Art",
  interestIds: ["art"],
  excerpt: "Forbidden excerpt",
  image: {
    src: "https://publisher.example/image.jpg",
    alt: "",
    credit: "",
    creditUrl: "",
  },
  author: "Author",
  publishedAt: "2026-10-06T12:00:00Z",
};
test("publisher permissions remove excerpts/images/bodies and ignore untrusted grants", () => {
  const safe = prepareStoryForDisplay({
    ...story,
    content: "Publisher body",
  } as EditorialStory);
  assert.equal(safe.excerpt, undefined);
  assert.equal(safe.image, undefined);
  assert.equal(safe.author, "Author");
  assert.equal(safe.source.contentPolicy.canDisplayFullText, false);
  assert.equal(JSON.stringify(safe).includes("Publisher body"), false);
  const allowed = prepareStoryForDisplay(story, {
    ...publisherPolicy,
    canDisplayImage: true,
    canDisplayExcerpt: true,
    canDisplayFullText: true,
  });
  assert.equal(allowed.excerpt, story.excerpt);
  assert.equal(allowed.source.contentPolicy.canDisplayFullText, false);
});
test("guest Saved filters old snapshots without erasing their original link", () => {
  const entry = makeSavedEntry(story)!;
  const items = parseSaved(JSON.stringify({ version: 2, items: [entry] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].item.image, undefined);
  assert.equal(items[0].key, "story:https://publisher.example/a");
});
test("guest merge keeps account choices and duplicate Saved is idempotent", () => {
  const merged = mergePreferences(prefs, {
    ...prefs,
    interests: ["science", "design", "music"],
    sources: ["aeon"],
  })!;
  assert.deepEqual(merged.interests, [
    "art",
    "music",
    "history",
    "science",
    "design",
  ]);
  assert.deepEqual(merged.sources, ["hyperallergic", "aeon"]);
  const entry = makeSavedEntry(story)!;
  assert.equal(mergeSaved([entry], [entry, entry]).length, 1);
  assert.deepEqual(prefs.interests, ["art", "music", "history"]);
});
test("archive reconstructs the persisted composition without provider fetching", () => {
  const envelope = {
    preferences: prefs,
    issue: {
      id: "guest",
      date: "2026-10-06",
      number: "001",
      stories: [story],
      culturalItems: [],
      sections: [
        {
          id: "lead",
          title: "Lead",
          storyIds: ["a"],
          culturalItemIds: [],
          interestIds: ["art"],
        },
      ],
    },
    fallback: false,
    partial: false,
    loadedCount: 1,
  };
  const stored = serializeIssue(envelope);
  const reconstructed = reconstructIssue(
    {
      id: "stable",
      issue_date: envelope.issue.date,
      issue_number: 4,
      created_at: "2026-10-06T12:00:00Z",
      preferences_snapshot: prefs,
      composition: stored.composition,
    },
    stored.entries.map((row) => ({
      position: row.position,
      item_type: row.type,
      snapshot: row.snapshot,
    })),
  );
  assert.equal(reconstructed.issue.id, "stable");
  assert.equal(reconstructed.issue.number, "004");
  assert.equal(reconstructed.issue.stories[0].title, "Original title");
  assert.equal(reconstructed.issue.stories[0].excerpt, undefined);
  assert.deepEqual(reconstructed.issue.sections, envelope.issue.sections);
});
test("authenticated Saved scopes reads/writes to the verified owner and surfaces write failures", async () => {
  const calls: unknown[][] = [];
  const entry = makeSavedEntry(story)!;
  const query = {
    select: (...v: unknown[]) => {
      calls.push(["select", ...v]);
      return query;
    },
    eq: (...v: unknown[]) => {
      calls.push(["eq", ...v]);
      return query;
    },
    order: async () => ({
      data: [
        {
          item_key: entry.key,
          item_type: entry.kind,
          snapshot: story,
          saved_at: entry.savedAt,
        },
      ],
      error: null,
    }),
    upsert: async (...v: unknown[]) => {
      calls.push(["upsert", ...v]);
      return { error: { message: "offline" } };
    },
  };
  const client = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;
  const repository = new SupabaseLibraryRepository(client, "verified-owner");
  const saved = await repository.saved();
  assert.equal(saved[0].item.image, undefined);
  assert.ok(
    calls.some(
      (c) => c[0] === "eq" && c[1] === "user_id" && c[2] === "verified-owner",
    ),
  );
  await assert.rejects(
    repository.setSaved(entry, true),
    /could not be updated/,
  );
  assert.equal(
    (calls.find((c) => c[0] === "upsert")![1] as { user_id: string }).user_id,
    "verified-owner",
  );
});
test("PostgreSQL migration: RLS isolation, transactional import, immutable/deduplicated daily issues", async () => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(
      `create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values ('${a}'),('${b}');`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610060001_library.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
    await db.query("select public.set_library_preferences($1::jsonb)", [
      JSON.stringify(prefs),
    ]);
    const entry = makeSavedEntry(story)!;
    await db.query("select public.merge_guest_library($1::jsonb,$2::jsonb)", [
      JSON.stringify({
        ...prefs,
        interests: ["science", "ideas", "art"],
        sources: ["aeon"],
      }),
      JSON.stringify([entry, entry]),
    ]);
    assert.equal((await db.query("select * from saved_items")).rows.length, 1);
    const accountPrefs = (
      await db.query<{ interests: string[] }>(
        "select interests from user_preferences",
      )
    ).rows[0];
    assert.ok(accountPrefs.interests.includes("science"));
    assert.ok(accountPrefs.interests.includes("music"));
    await assert.rejects(
      db.query("select public.merge_guest_library($1::jsonb,$2::jsonb)", [
        JSON.stringify({
          ...prefs,
          interests: ["books", "design", "psychology"],
        }),
        JSON.stringify([{ ...entry, savedAt: "invalid date" }]),
      ]),
      /invalid input syntax/,
    );
    assert.equal(
      (
        await db.query<{ interests: string[] }>(
          "select interests from user_preferences",
        )
      ).rows[0].interests.includes("books"),
      false,
      "failed import rolls back preference changes",
    );
    // Direct REST writes are filtered by the database trigger as well.
    await db.query("update saved_items set snapshot=$1::jsonb", [
      JSON.stringify({ ...story, content: "Full publisher body" }),
    ]);
    const saved = (
      await db.query<{ snapshot: EditorialStory }>(
        "select snapshot from saved_items",
      )
    ).rows[0].snapshot;
    assert.equal(saved.excerpt, undefined);
    assert.equal(saved.image, undefined);
    assert.equal(JSON.stringify(saved).includes("Full publisher body"), false);
    const composition = {
      sections: [],
      fallback: false,
      partial: false,
      loadedCount: 1,
    };
    const entries = [
      {
        position: 0,
        type: "externalArticle",
        section: "lead",
        sourceId: "unknown",
        externalId: "a",
        originalUrl: story.url,
        snapshot: story,
      },
    ];
    const create = async (date: string) =>
      (
        await db.query<{ id: string }>(
          "select create_magazine_issue($1::date,$2::jsonb,$3::jsonb,$4::jsonb) as id",
          [
            date,
            JSON.stringify(prefs),
            JSON.stringify(composition),
            JSON.stringify(entries),
          ],
        )
      ).rows[0].id;
    const id = await create("2026-10-06");
    assert.equal(await create("2026-10-06"), id);
    await create("2026-10-07");
    assert.deepEqual(
      (
        await db.query<{ issue_number: number }>(
          "select issue_number from magazine_issues order by issue_number",
        )
      ).rows.map((r) => r.issue_number),
      [1, 2],
    );
    await assert.rejects(
      db.exec("update magazine_issues set issue_number=10"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into user_preferences(user_id,interests) values($1,array['art'])",
        [b],
      ),
      /row-level security/,
    );
    await db.exec(`set request.jwt.claim.sub='${b}';`);
    for (const table of [
      "profiles",
      "user_preferences",
      "user_sources",
      "saved_items",
      "magazine_issues",
      "magazine_issue_items",
    ])
      assert.equal(
        (await db.query(`select * from ${table}`)).rows.length,
        0,
        table + " owner isolation",
      );
    await db.query("select public.set_library_preferences($1::jsonb)", [
      JSON.stringify(prefs),
    ]);
    await create("2026-10-06");
    assert.equal(
      (
        await db.query<{ issue_number: number }>(
          "select issue_number from magazine_issues",
        )
      ).rows[0].issue_number,
      1,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from magazine_issues"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "select create_magazine_issue('2026-10-06', '{}'::jsonb,'{}'::jsonb,'[]'::jsonb)",
      ),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("same-origin checks use the public Host while rejecting cross-origin library writes", () => {
  const request = new Request("http://0.0.0.0:3000/api/issue", {
    headers: { host: "localhost:3000", origin: "http://localhost:3000" },
  });
  assert.equal(sameOrigin(request), true);
  assert.equal(publicRequestUrl(request).origin, "http://localhost:3000");
  assert.equal(
    sameOrigin(
      new Request("http://0.0.0.0:3000/api/account", {
        headers: { host: "localhost:3000", origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(new Request("http://localhost:3000/api/account")),
    false,
  );
});

test("account transport is private, bounds failures and does not report failed writes as success", async () => {
  const original = globalThis.fetch;
  let options: RequestInit | undefined;
  try {
    globalThis.fetch = async (_url, init) => {
      options = init;
      return Response.json({ error: "Write not confirmed" }, { status: 503 });
    };
    await assert.rejects(
      repositoryRequest("/api/account", "POST", { operation: "saved" }),
      /Write not confirmed/,
    );
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal);
    globalThis.fetch = async () => {
      throw new TypeError("Offline");
    };
    await assert.rejects(
      repositoryRequest("/api/account"),
      /could not be reached/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
