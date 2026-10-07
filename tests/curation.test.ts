import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MagazineIssueView } from "../components/editorial/IssueExperience";
import { AccountStateContext } from "../lib/repositories/account-store";
import { publicationGroups } from "../lib/sources/publications";
import { topicSeeds } from "../lib/sources/wikipedia";
import { discoveryOrder, discoveryAttempts } from "../lib/sources/selection";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildMagazineIssue } from "../lib/buildMagazineIssue";
import { balancedSelection, itemIdentity } from "../lib/editorial/selection";
import {
  refreshStorySection,
  refreshCulturalItem,
} from "../lib/editorial/refresh";
import { parseGuestIssue } from "../lib/editorial/guest";
import {
  serializeIssue,
  reconstructIssue,
} from "../lib/repositories/composition";
import { publisherPolicy } from "../lib/content/policies";
import { sourceRegistry } from "../lib/sources/registry";
import { savedKey } from "../lib/storage/saved-parser";
import { sourceCatalog } from "../data/catalog";
import { normalizeWikipedia } from "../lib/sources/wikipedia";
import { normalizeMetObject } from "../lib/sources/met";
import type {
  EditorialStory,
  UserMagazinePreferences,
} from "../types/editorial";
const preferences: UserMagazinePreferences = {
  version: 1,
  interests: ["music", "design", "art", "history"],
  sources: [],
  customSources: [],
};
function story(id: string, source: string, category = "music"): EditorialStory {
  return {
    id,
    title: `Fixture ${id}`,
    url: `https://example.com/${id}`,
    source: {
      id: source,
      name: source,
      slug: source,
      websiteUrl: "https://example.com",
      sourceType: "rss",
      contentPolicy: publisherPolicy,
      categories: [category],
    },
    sourceType: "rss",
    contentPolicy: "external",
    category,
    interestIds: [category],
    publishedAt: "2026-10-06T10:00:00Z",
  };
}
const music = Array.from({ length: 40 }, (_, i) =>
  story(`music${i}`, i < 30 ? "large-pool" : "small-pool"),
);
const fixtures = [
  ...music,
  ...["design", "art", "history"].flatMap((category) =>
    Array.from({ length: 8 }, (_, i) =>
      story(`${category}${i}`, `${category}-source`, category),
    ),
  ),
];
test("source pool size does not buy editorial dominance; one source degrades gracefully", () => {
  const prefs = { ...preferences, interests: ["music"] };
  const chosen = balancedSelection(music, prefs, 10);
  assert.equal(
    chosen.filter((s) => s.story.source.id === "large-pool").length,
    5,
  );
  assert.equal(balancedSelection(music, prefs, 10).length, 10);
  const single = balancedSelection(music.slice(0, 8), prefs, 10);
  assert.equal(single.length, 8);
});
test("category visibility and finite deterministic fixtures cover one, three, many interests", () => {
  for (const ids of [
    ["music"],
    ["music", "art", "design"],
    preferences.interests,
  ]) {
    const p = { ...preferences, interests: ids };
    const issue = buildMagazineIssue({
      preferences: p,
      stories: fixtures,
      date: "2026-10-06",
    });
    assert.ok(issue.stories.length <= 11);
    for (const id of ids)
      assert.ok(issue.stories.some((s) => s.interestIds.includes(id)));
    assert.deepEqual(
      issue,
      buildMagazineIssue({
        preferences: p,
        stories: [...fixtures].reverse(),
        date: "2026-10-06",
      }),
    );
  }
  const issue = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-06",
  });
  assert.ok(issue.sections.some((s) => s.id === "history"));
});
test("canonical recent URLs are preferred out, with relevant repeated fallback", () => {
  const pool = [story("old", "one"), story("fresh", "two")];
  const recent = [itemIdentity(pool[0])];
  assert.equal(
    balancedSelection(pool, preferences, 1, { recent })[0].story.id,
    "fresh",
  );
  assert.equal(
    balancedSelection([pool[0]], preferences, 1, { recent })[0].story.id,
    "old",
  );
  assert.equal(
    itemIdentity({
      ...pool[0],
      url: "https://www.example.com/old/?utm_source=test#section",
    }),
    recent[0],
  );
});
test("section refresh excludes every current story, preserves count, interests, untouched modules and permissions", () => {
  const original = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-06",
  });
  const section = original.sections.find((s) => s.id === "music")!;
  const refreshed = refreshStorySection(
    original,
    section.id,
    fixtures.map((s) => ({
      ...s,
      excerpt: "forbidden",
      content: "forbidden",
      image: {
        src: "https://example.com/image.jpg",
        alt: "",
        credit: "",
        creditUrl: "https://example.com",
      },
    })),
    preferences,
    [],
    1,
  )!;
  assert.ok(refreshed);
  const ids = refreshed.sections.find((s) => s.id === section.id)!.storyIds;
  assert.equal(ids.length, section.storyIds.length);
  assert.ok(ids.every((id) => !original.stories.some((s) => s.id === id)));
  assert.deepEqual(
    refreshed.sections.filter((s) => s.id !== section.id),
    original.sections.filter((s) => s.id !== section.id),
  );
  assert.deepEqual(refreshed.onThisDay, original.onThisDay);
  assert.ok(
    refreshed.stories.every((s) => !s.excerpt && !s.image && !("content" in s)),
  );
  assert.deepEqual(
    refreshed,
    refreshStorySection(
      original,
      section.id,
      [...fixtures].reverse(),
      preferences,
      [],
      1,
    ),
  );
  assert.equal(
    refreshStorySection(original, "lead", fixtures, preferences, [], 1),
    null,
  );
  assert.equal(
    refreshStorySection(
      original,
      section.id,
      original.stories,
      preferences,
      [],
      1,
    ),
    null,
  );
});
test("Wikipedia and public-domain artwork replacements keep source licenses and reject current identities", () => {
  const wiki = normalizeWikipedia({
    pageid: 1,
    title: "Fixture subject",
    extract: "Source-derived introductory text. ".repeat(12),
    length: 3000,
  })!;
  const art = normalizeMetObject({
    objectID: 1,
    isPublicDomain: true,
    primaryImage: "https://images.metmuseum.org/image.jpg",
    title: "Fixture painting",
    medium: "Oil",
    department: "Paintings",
    objectDate: "1900",
  })!;
  const issue = {
    ...buildMagazineIssue({
      preferences,
      stories: fixtures,
      date: "2026-10-06",
    }),
    culturalItems: [wiki, art],
  };
  assert.equal(refreshCulturalItem(issue, "rabbit-hole", wiki), null);
  const next = refreshCulturalItem(issue, "rabbit-hole", {
    ...wiki,
    id: "wikipedia:2",
    pageId: 2,
  })!;
  assert.equal(next.culturalItems[0].source.license?.name, "CC BY-SA 4.0");
  assert.deepEqual(
    JSON.parse(JSON.stringify(next.culturalItems[1])),
    JSON.parse(JSON.stringify(art)),
  );
  const nextArt = refreshCulturalItem(issue, "artwork", {
    ...art,
    id: "met:2",
    objectId: 2,
    image: { ...art.image!, src: "https://images.metmuseum.org/new.jpg" },
  })!;
  assert.equal(nextArt.culturalItems[1].source.license?.name, "CC0 1.0");
  assert.equal(
    normalizeMetObject({
      ...{
        objectID: 3,
        isPublicDomain: false,
        primaryImage: "https://images.metmuseum.org/image.jpg",
        title: "No rights",
        medium: "Oil",
        department: "Paintings",
        objectDate: "1900",
      },
    }),
    undefined,
  );
});
test("guest accepted composition survives parsing and source registry never activates unavailable feeds", () => {
  const issue = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-06",
  });
  const envelope = {
    preferences,
    issue,
    fallback: false,
    partial: false,
    loadedCount: 5,
    revision: 2,
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(parseGuestIssue(envelope)?.issue)),
    JSON.parse(JSON.stringify(issue)),
  );
  assert.equal(
    parseGuestIssue({
      ...envelope,
      issue: {
        ...issue,
        stories: [{ ...issue.stories[0], url: "javascript:alert(1)" }],
      },
    }),
    null,
  );
  assert.equal(
    sourceRegistry.find((s) => s.id === "its-nice-that")?.enabled,
    false,
  );
  assert.ok(
    sourceRegistry
      .filter((s) => s.enabled)
      .every(
        (s) =>
          s.status === "ACTIVE" &&
          s.feedUrl &&
          s.contentPolicy === publisherPolicy,
      ),
  );
  assert.ok(sourceCatalog.some((s) => s.id === "hacker-news"));
});
test("revision migration keeps base and accepted snapshots immutable, owner-private and bounded to recent final issues", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(
      `create schema auth;create table auth.users(id uuid primary key);create role anon;create role authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;insert into auth.users values('${owner}'),('${other}');`,
    );
    for (const file of [
      "202610060001_library.sql",
      "202610060002_issue_revisions.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      `set role authenticated;set request.jwt.claim.sub='${owner}';`,
    );
    const date = (
      await db.query<{ date: string }>(
        "select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as date",
      )
    ).rows[0].date;
    const initialArt = normalizeMetObject({
      objectID: 1,
      isPublicDomain: true,
      primaryImage: "https://images.metmuseum.org/A.jpg",
      title: "Artwork A",
      medium: "Oil",
      department: "Paintings",
      objectDate: "1600",
      creditLine: "Credit A",
    })!;
    const issue = buildMagazineIssue({
      preferences,
      stories: fixtures,
      date,
      culturalContent: { artwork: initialArt, events: [] },
    });
    const envelope = {
      preferences,
      issue,
      fallback: false,
      partial: false,
      loadedCount: 5,
    };
    const original = serializeIssue(envelope);
    const create = async (period: string) =>
      (
        await db.query<{ id: string }>(
          "select create_magazine_issue($1::date,$2::jsonb,$3::jsonb,$4::jsonb) as id",
          [
            period,
            JSON.stringify(preferences),
            JSON.stringify(original.composition),
            JSON.stringify(original.entries),
          ],
        )
      ).rows[0].id;
    const id = await create(date);
    const baseRows = (
      await db.query<{
        position: number;
        item_type: string;
        snapshot: unknown;
      }>(
        "select position,item_type,snapshot from magazine_issue_items where issue_id=$1 order by position",
        [id],
      )
    ).rows;
    const persisted = reconstructIssue(
      {
        id,
        issue_date: date,
        issue_number: 1,
        created_at: date,
        preferences_snapshot: preferences,
        composition: original.composition,
      },
      baseRows,
    );
    const section = persisted.issue.sections.find((s) => s.id === "music")!;
    const refreshed = refreshStorySection(
      persisted.issue,
      "music",
      fixtures,
      preferences,
      [],
      1,
    )!;
    const revision = serializeIssue({ ...persisted, issue: refreshed });
    const revise = (
      expected: number,
      entries = revision.entries,
      composition = revision.composition,
      target = id,
    ) =>
      db.query(
        "select revise_magazine_issue($1::uuid,$2,$3,$4::jsonb,$5::jsonb)",
        [
          target,
          expected,
          "music",
          JSON.stringify(composition),
          JSON.stringify(entries),
        ],
      );
    await revise(0);
    assert.equal(
      (await db.query("select * from magazine_issue_revisions")).rows.length,
      1,
    );
    assert.deepEqual(
      (
        await db.query(
          "select position,item_type,snapshot from magazine_issue_items where issue_id=$1 order by position",
          [id],
        )
      ).rows,
      baseRows,
    );
    await assert.rejects(revise(0), /changed/);
    await assert.rejects(
      revise(
        1,
        revision.entries.map((e) =>
          e.section === "lead"
            ? {
                ...e,
                snapshot: {
                  ...(e.snapshot as EditorialStory),
                  title: "Tampered lead",
                },
              }
            : e,
        ),
      ),
      /Other discoveries cannot change/,
    );
    await assert.rejects(
      revise(1, revision.entries, {
        ...revision.composition,
        loadedCount: 999,
      }),
      /metadata cannot change/,
    );

    await assert.rejects(
      db.exec("update magazine_issue_revisions set revision_number=9"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("delete from magazine_issue_revisions"),
      /permission denied/,
    );
    const stored = (
      await db.query<{
        entries: typeof revision.entries;
        composition: typeof revision.composition;
      }>("select entries,composition from magazine_issue_revisions")
    ).rows[0];
    const reopened = reconstructIssue(
      {
        id,
        issue_date: date,
        issue_number: 1,
        created_at: date,
        preferences_snapshot: preferences,
        composition: stored.composition,
      },
      stored.entries.map((e) => ({
        position: e.position,
        item_type: e.type,
        snapshot: e.snapshot,
      })),
    );
    assert.deepEqual(
      reopened.issue.sections.find((s) => s.id === "music")?.storyIds,
      refreshed.sections.find((s) => s.id === "music")?.storyIds,
    );
    assert.ok(!reopened.issue.stories.some((s) => s.excerpt || s.image));
    assert.equal(
      reopened.issue.sections.find((s) => s.id === "music")?.storyIds.length,
      section.storyIds.length,
    );
    for (let i = 1; i <= 6; i++) {
      const d = (
        await db.query<{ date: string }>(
          "select ($1::date-$2::integer)::text as date",
          [date, i],
        )
      ).rows[0].date;
      await create(d);
    }
    const recent = (
      await db.query("select * from recent_magazine_items(($1::date+1))", [
        date,
      ])
    ).rows;
    assert.equal(recent.length, original.entries.length * 5);
    assert.ok(
      recent.some(
        (r) =>
          (r as { external_id: string }).external_id ===
          revision.entries.find((e) => e.section === "music")?.externalId,
      ),
    );
    const yesterday = (
      await db.query<{ id: string }>(
        "select id from magazine_issues where issue_date=$1::date-1",
        [date],
      )
    ).rows[0].id;
    await assert.rejects(
      revise(0, revision.entries, revision.composition, yesterday),
      /Archived/,
    );
    const artB = {
      ...initialArt,
      id: "met:2",
      objectId: 2,
      title: "Artwork B",
      image: {
        ...initialArt.image!,
        src: "https://images.metmuseum.org/B.jpg",
      },
      attribution:
        "The Metropolitan Museum of Art · Credit B · Public domain / CC0",
      creditLine: "Credit B",
      originalUrl: "https://www.metmuseum.org/art/collection/search/2",
      internalUrl: "/explore/artwork/2",
    };
    const artRevision = serializeIssue({
      ...reopened,
      issue: refreshCulturalItem(reopened.issue, "artwork", artB)!,
    });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await db.query(
      "select revise_magazine_issue($1::uuid,1,'artwork',$2::jsonb,$3::jsonb)",
      [
        id,
        JSON.stringify(artRevision.composition),
        JSON.stringify(artRevision.entries),
      ],
    );
    const finalRows = (
      await db.query<{ entries: typeof artRevision.entries }>(
        "select entries from magazine_issue_revisions where issue_id=$1 order by revision_number desc limit 1",
        [id],
      )
    ).rows[0].entries;
    const persistedArt = finalRows.find((entry) => entry.type === "artwork")!
      .snapshot as typeof artB;
    for (const field of [
      "id",
      "objectId",
      "title",
      "image",
      "attribution",
      "creditLine",
      "originalUrl",
      "internalUrl",
      "medium",
      "department",
      "isPublicDomain",
    ] as const)
      assert.deepEqual(persistedArt[field], artB[field]);
    await db.exec(`set request.jwt.claim.sub='${other}';`);
    assert.equal(
      (await db.query("select * from magazine_issue_revisions")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from recent_magazine_items($1::date)", [date]))
        .rows.length,
      0,
    );
    await assert.rejects(revise(0), /unavailable/);
    await db.exec("set role anon;");
    await assert.rejects(
      db.query("select * from magazine_issue_revisions"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from recent_magazine_items($1::date)", [date]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("cultural candidate order excludes current IDs, prefers fresh identities, and retains bounded repeated fallback", () => {
  for (const prefix of ["wikipedia", "met"]) {
    const id = (value: number) => `${prefix}:${value}`;
    const options = { exclude: [id(1)], recent: [id(2), id(3)], counter: 1 };
    const order = discoveryOrder([1, 2, 3, 4], "period", id, options);
    assert.equal(order[0], 4);
    assert.ok(!order.includes(1));
    assert.deepEqual(
      order,
      discoveryOrder([4, 3, 2, 1], "period", id, options),
    );
    assert.deepEqual(
      discoveryAttempts(order, id, options.recent, 1).slice(0, 1),
      [4],
    );
    assert.equal(discoveryAttempts([2], id, [id(2)], 3)[0], 2);
  }
});
test("all-interests fixtures stay finite and custom publication identities share the same balance rules", () => {
  const ids = [
    "music",
    "art",
    "design",
    "history",
    "science",
    "technology",
    "books",
    "architecture",
    "travel",
    "psychology",
    "ideas",
    "photography",
    "film",
    "food",
    "nature",
    "creativity",
  ];
  const pool = ids.flatMap((category) =>
    Array.from({ length: 3 }, (_, i) =>
      story(`${category}-${i}`, `${category}-publisher`, category),
    ),
  );
  const issue = buildMagazineIssue({
    preferences: { ...preferences, interests: ids },
    stories: pool,
    date: "2026-10-06",
  });
  assert.equal(issue.stories.length, 10);
  assert.ok(new Set(issue.stories.flatMap((s) => s.interestIds)).size >= 9);
  const custom = music.map((s) => ({
    ...s,
    source: {
      ...s.source,
      id: s.source.id === "large-pool" ? "custom:large" : "curated",
    },
  }));
  const chosen = balancedSelection(
    custom,
    { ...preferences, interests: ["music"] },
    10,
  );
  assert.equal(
    chosen.filter((s) => s.story.source.id === "custom:large").length,
    5,
  );
});

test("Archive renders the accepted issue without refresh actions; Today uses unobtrusive section controls", () => {
  const issue = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-06",
  });
  const response = {
    preferences,
    issue,
    fallback: false,
    partial: false,
    loadedCount: 5,
    revision: 1,
    refreshAvailable: true,
  };
  const render = (archived: boolean) =>
    renderToStaticMarkup(
      createElement(
        AccountStateContext.Provider,
        {
          value: {
            mode: "account",
            identity: { userId: "owner" },
            data: { userId: "owner", preferences, saved: [] },
          },
        },
        createElement(MagazineIssueView, { preferences, response, archived }),
      ),
    );
  const archive = render(true);
  assert.ok(archive.includes("your final selection"));
  assert.ok(!archive.includes("Different Music stories"));
  assert.ok(render(false).includes("Different Music stories"));
});

test("artwork replacement keeps complete object payload through guest and archive snapshots", () => {
  const make = (id: number) =>
    normalizeMetObject({
      objectID: id,
      isPublicDomain: true,
      primaryImage: `https://images.metmuseum.org/${id}.jpg`,
      title: `Artwork ${id}`,
      objectDate: `${1500 + id}`,
      medium: `Medium ${id}`,
      department: `Department ${id}`,
      artistDisplayName: `Artist ${id}`,
      creditLine: `Credit ${id}`,
      objectURL: `https://www.metmuseum.org/art/collection/search/${id}`,
    })!;
  const a = make(1),
    b = make(2);
  const base = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-07",
    culturalContent: { artwork: a, events: [] },
  });
  const updated = refreshCulturalItem(base, "artwork", b)!;
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(updated.culturalItems.find((i) => i.kind === "artwork")),
    ),
    JSON.parse(JSON.stringify(b)),
  );
  assert.notEqual(a.image!.src, b.image!.src);
  assert.equal(
    refreshCulturalItem(base, "artwork", { ...b, image: a.image }),
    null,
  );
  assert.notEqual(savedKey(a), savedKey(b));
  const envelope = {
    issue: updated,
    preferences,
    fallback: false,
    partial: false,
    loadedCount: 11,
    revision: 1,
    recentSelections: [itemIdentity(a)],
  };
  const guest = parseGuestIssue(envelope)!;
  assert.deepEqual(
    JSON.parse(JSON.stringify(guest.issue.culturalItems[0])),
    JSON.parse(JSON.stringify(b)),
  );
  assert.deepEqual(guest.recentSelections, [itemIdentity(a)]);
  const serialized = serializeIssue(envelope);
  const archive = reconstructIssue(
    {
      id: updated.id,
      issue_date: updated.date,
      issue_number: 1,
      created_at: "2026-10-07T12:00:00Z",
      preferences_snapshot: preferences,
      composition: serialized.composition,
    },
    serialized.entries.map((e) => ({
      position: e.position,
      item_type: e.type,
      snapshot: e.snapshot,
    })),
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(archive.issue.culturalItems[0])),
    JSON.parse(JSON.stringify(b)),
  );
});

test("refresh history prefers a third choice rather than returning to the first", () => {
  const base = buildMagazineIssue({
    preferences,
    stories: fixtures,
    date: "2026-10-07",
  });
  const section = base.sections.find(
    (s) => s.id !== "lead" && s.id !== "outside" && s.storyIds.length,
  )!;
  const first = base.stories
    .filter((s) => section.storyIds.includes(s.id))
    .map(itemIdentity);
  const second = refreshStorySection(
    base,
    section.id,
    fixtures,
    preferences,
    first,
    1,
  )!;
  const third = refreshStorySection(
    second,
    section.id,
    fixtures,
    preferences,
    first,
    2,
  )!;
  assert.ok(
    third.stories
      .filter((s) =>
        third.sections
          .find((g) => g.id === section.id)!
          .storyIds.includes(s.id),
      )
      .every((s) => !first.includes(itemIdentity(s))),
  );
});

test("publication rack contains active editorial publications, excluding built-in and unavailable providers", () => {
  const ids = publicationGroups.flatMap((group) => group.sourceIds);
  assert.equal(ids.length, 13);
  for (const id of ["its-nice-that", "wikipedia", "met"])
    assert.ok(!ids.includes(id));
  assert.ok(publicationGroups.every((group) => group.sourceIds.length > 0));
});

test("coverage fixtures expose unsupported editorial interests instead of manufacturing sections", () => {
  for (const [ids, weak] of [
    [
      ["travel", "food", "psychology", "film"],
      ["food", "film"],
    ],
    [
      ["design", "art", "architecture", "photography", "ideas"],
      ["photography"],
    ],
    [["music", "film", "books", "history"], ["film"]],
    [["technology", "science", "psychology", "ideas", "design"], []],
  ]) {
    const candidates = sourceRegistry
      .filter((source) => source.enabled)
      .flatMap((source) =>
        source.categories.map((category) =>
          story(`${source.id}-${category}`, source.id, category),
        ),
      );
    const issue = buildMagazineIssue({
      preferences: { ...preferences, interests: ids },
      stories: candidates,
      date: "2026-10-07",
    });
    assert.ok(issue.stories.length <= 11);
    for (const id of weak)
      assert.ok(!issue.sections.some((section) => section.id === id));
    for (const id of ids) assert.ok(topicSeeds[id]?.length);
  }
});

test("full lead titles and sparse sections retain deliberate one/two-story layouts", () => {
  for (const length of [20, 50, 100, 160, 230]) {
    const issue = buildMagazineIssue({
      preferences,
      stories: [
        story("lead", "music"),
        story("a", "art", "art"),
        story("b", "design", "design"),
        story("c", "design", "design"),
      ],
      date: "2026-10-07",
    });
    const leadId = issue.sections.find((s) => s.id === "lead")!.storyIds[0];
    const headline = "Editorial headline about culture and curiosity "
      .repeat(6)
      .slice(0, length);
    issue.stories.find((s) => s.id === leadId)!.title = headline;
    // Fix a sparse composition independent of which fixture becomes the lead.
    const remaining = issue.stories.filter((s) => s.id !== leadId);
    issue.sections = [
      issue.sections.find((s) => s.id === "lead")!,
      {
        id: "art",
        title: "Art",
        storyIds: [remaining[0].id],
        culturalItemIds: [],
        interestIds: ["art"],
      },
      {
        id: "design",
        title: "Design",
        storyIds: remaining.slice(1).map((s) => s.id),
        culturalItemIds: [],
        interestIds: ["design"],
      },
    ];
    const html = renderToStaticMarkup(
      createElement(MagazineIssueView, {
        preferences,
        response: {
          preferences,
          issue,
          fallback: false,
          partial: false,
          loadedCount: 3,
        },
        archived: true,
      }),
    );
    assert.ok(html.includes(headline));
    assert.ok(html.includes("single-story"));
    assert.ok(html.includes("two-stories"));
    assert.ok(!html.includes("line-clamp"));
  }
});
