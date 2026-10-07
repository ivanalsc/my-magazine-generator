import { hydratePickSnapshot } from "@/lib/picks/persistence";
import { itemIdentity } from "@/lib/editorial/selection";
import { canonicalArticleUrl } from "@/lib/sources/deduplicate";
import { safeAuthDiagnostic } from "@/lib/account/presentation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePreferences } from "@/lib/preferences";
import { parseSaved, savedKey } from "@/lib/storage/saved-parser";
import {
  reconstructIssue,
  serializeIssue,
  type IssueRecord,
} from "./composition";
import type { AccountData, IssueEnvelope, IssueSummary } from "./models";
import type {
  CulturalItem,
  EditorialStory,
  UserMagazinePreferences,
} from "@/types/editorial";
import type { SavedItem } from "@/types/saved";
function check(error: { message: string } | null) {
  if (error) {
    if (process.env.NODE_ENV === "development")
      console.error(
        "[library] Database operation failed",
        safeAuthDiagnostic(error),
      );
    throw new Error(
      "Your account library could not be updated. Please try again.",
    );
  }
}
export class SupabaseLibraryRepository {
  constructor(
    private client: SupabaseClient,
    private userId: string,
    private email?: string,
  ) {}
  async preferences(): Promise<UserMagazinePreferences | null> {
    const [prefs, sources] = await Promise.all([
      this.client
        .from("user_preferences")
        .select("version,interests")
        .eq("user_id", this.userId)
        .maybeSingle(),
      this.client
        .from("user_sources")
        .select("source_id,kind,metadata,position")
        .eq("user_id", this.userId)
        .order("position"),
    ]);
    check(prefs.error);
    check(sources.error);
    return prefs.data
      ? parsePreferences(
          JSON.stringify({
            ...prefs.data,
            sources: sources
              .data!.filter((s) => s.kind === "curated")
              .map((s) => s.source_id),
            customSources: sources
              .data!.filter((s) => s.kind === "custom")
              .map((s) => s.metadata),
          }),
        )
      : null;
  }
  async saved(): Promise<SavedItem[]> {
    const { data, error } = await this.client
      .from("saved_items")
      .select("item_key,item_type,snapshot,saved_at")
      .eq("user_id", this.userId)
      .order("saved_at", { ascending: false });
    check(error);
    const rows = await Promise.all(
      data!.map(async (row) => ({
        ...row,
        snapshot: await hydratePickSnapshot(row.snapshot),
      })),
    );
    return parseSaved(
      JSON.stringify({
        version: 2,
        items: rows.map((row) => ({
          key: row.item_key,
          kind: row.item_type,
          item: row.snapshot,
          savedAt: row.saved_at,
        })),
      }),
    );
  }
  async account(): Promise<AccountData> {
    const [preferences, saved] = await Promise.all([
      this.preferences(),
      this.saved(),
    ]);
    return { userId: this.userId, email: this.email, preferences, saved };
  }
  async setPreferences(preferences: UserMagazinePreferences | null) {
    const { error } = await this.client.rpc("set_library_preferences", {
      prefs: preferences,
    });
    check(error);
  }
  async setSaved(entry: SavedItem, keep: boolean) {
    const result = keep
      ? await this.client.from("saved_items").upsert(
          {
            user_id: this.userId,
            item_key: entry.key,
            item_type: entry.kind,
            snapshot: entry.item,
            saved_at: entry.savedAt,
          },
          { onConflict: "user_id,item_key", ignoreDuplicates: true },
        )
      : await this.client
          .from("saved_items")
          .delete()
          .eq("user_id", this.userId)
          .eq("item_key", entry.key);
    check(result.error);
  }
  async issue(id: string): Promise<IssueEnvelope | null> {
    const record = await this.client
      .from("magazine_issues")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    check(record.error);
    if (!record.data) return null;
    const items = await this.client
      .from("magazine_issue_items")
      .select("position,item_type,snapshot")
      .eq("issue_id", id)
      .order("position");
    check(items.error);
    const revision = await this.client
      .from("magazine_issue_revisions")
      .select("revision_number,composition,entries")
      .eq("issue_id", id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const missing =
      revision.error && ["PGRST205", "42P01"].includes(revision.error.code);
    if (!missing) check(revision.error);
    const latest = revision.data;
    const history = missing
      ? null
      : await this.client
          .from("magazine_issue_revisions")
          .select("entries")
          .eq("issue_id", id)
          .order("revision_number", { ascending: false })
          .limit(30);
    if (history) check(history.error);
    // Owner-bound, bounded revision snapshots; never accept client history for accounts.
    const recentSelections = [
      ...new Set([
        ...items.data!.map((row) => itemIdentity(row.snapshot)),
        ...[...(history?.data ?? [])]
          .reverse()
          .flatMap((row) =>
            row.entries.map(
              (entry: { snapshot: Parameters<typeof itemIdentity>[0] }) =>
                itemIdentity(entry.snapshot),
            ),
          ),
      ]),
    ].slice(-300);

    const activeRows = latest
      ? latest.entries.map(
          (entry: { position: number; type: string; snapshot: unknown }) => ({
            position: entry.position,
            item_type: entry.type,
            snapshot: entry.snapshot,
          }),
        )
      : items.data!;
    const hydrated = await Promise.all(
      activeRows.map(
        async (row: {
          position: number;
          item_type: string;
          snapshot: unknown;
        }) => ({ ...row, snapshot: await hydratePickSnapshot(row.snapshot) }),
      ),
    );
    const envelope = reconstructIssue(
      {
        ...record.data,
        composition: latest?.composition ?? record.data.composition,
      } as IssueRecord,
      hydrated,
    );
    return {
      ...envelope,
      revision: latest?.revision_number ?? 0,
      refreshAvailable: !missing,
      recentSelections,
    };
  }
  async issueForDate(date: string) {
    const result = await this.client
      .from("magazine_issues")
      .select("id")
      .eq("user_id", this.userId)
      .eq("issue_date", date)
      .maybeSingle();
    check(result.error);
    return result.data ? this.issue(result.data.id) : null;
  }
  async createIssue(envelope: IssueEnvelope): Promise<IssueEnvelope> {
    const serialized = serializeIssue(envelope);
    const { data, error } = await this.client.rpc("create_magazine_issue", {
      period: envelope.issue.date,
      ...serialized,
    });
    check(error);
    const result = await this.issue(data);
    if (!result) throw new Error("Your issue was not saved. Please try again.");
    return result;
  }
  async reviseIssue(
    envelope: IssueEnvelope,
    section: string,
    expected: number,
  ): Promise<IssueEnvelope> {
    const serialized = serializeIssue(envelope);
    const { error } = await this.client.rpc("revise_magazine_issue", {
      target: envelope.issue.id,
      expected,
      section,
      composition: serialized.composition,
      entries: serialized.entries,
    });
    check(error);
    const result = await this.issue(envelope.issue.id);
    if (!result) throw new Error("Your selection could not be saved.");
    return result;
  }
  async recentHistory(date: string): Promise<string[]> {
    const result = await this.client.rpc("recent_magazine_items", {
      before_date: date,
    });
    let rows = result.data as
      { item_type: string; external_id: string; original_url: string }[] | null;
    if (result.error && ["PGRST202", "42883"].includes(result.error.code)) {
      const headers = await this.client
        .from("magazine_issues")
        .select("id")
        .eq("user_id", this.userId)
        .lt("issue_date", date)
        .order("issue_date", { ascending: false })
        .limit(5);
      check(headers.error);
      if (!headers.data?.length) return [];
      const items = await this.client
        .from("magazine_issue_items")
        .select("item_type,external_id,original_url")
        .in(
          "issue_id",
          headers.data.map((r) => r.id),
        )
        .limit(150);
      check(items.error);
      rows = items.data;
    } else check(result.error);
    return [
      ...new Set(
        (rows ?? []).flatMap((row) =>
          row.item_type === "externalArticle"
            ? [
                `url:${canonicalArticleUrl(row.original_url) ?? row.original_url}`,
              ]
            : row.item_type === "wikipediaDiscovery"
              ? [`wikipedia:${row.external_id}`]
              : row.item_type === "artwork"
                ? [`met:${row.external_id}`]
                : ["film", "tv", "book", "album"].includes(row.item_type)
                  ? [
                      row.item_type === "film"
                        ? `tmdb:movie:${row.external_id}`
                        : row.item_type === "tv"
                          ? `tmdb:tv:${row.external_id}`
                          : `${row.item_type === "book" ? "openlibrary" : "musicbrainz"}:${row.external_id}`,
                    ]
                  : [],
        ),
      ),
    ].sort();
  }
  async listIssues(): Promise<IssueSummary[]> {
    const { data, error } = await this.client
      .from("magazine_issues")
      .select(
        "id,issue_number,issue_date,created_at,preferences_snapshot,composition,magazine_issue_items(count)",
      )
      .eq("user_id", this.userId)
      .order("issue_number", { ascending: false });
    check(error);
    return data!.map((row) => ({
      id: row.id,
      number: String(row.issue_number).padStart(3, "0"),
      date: row.issue_date,
      createdAt: row.created_at,
      preferences: row.preferences_snapshot,
      pieces: row.magazine_issue_items[0]?.count ?? 0,
    }));
  }
}
export function makeSavedEntry(
  item: EditorialStory | CulturalItem,
): SavedItem | null {
  const kind =
    item.contentPolicy === "external"
      ? "externalArticle"
      : "mediaType" in item
        ? (item.mediaType as import("@/types/pick").CulturalPick["mediaType"])
        : "pageId" in item
          ? "wikipediaDiscovery"
          : "objectId" in item
            ? "artwork"
            : "legacyCultural";
  return (
    parseSaved(
      JSON.stringify({
        version: 2,
        items: [
          {
            kind,
            key: savedKey(item),
            savedAt: new Date().toISOString(),
            item,
          },
        ],
      }),
    )[0] ?? null
  );
}
