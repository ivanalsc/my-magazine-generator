import { persistenceSnapshot } from "@/lib/picks/persistence";
import type { MagazineIssue, UserMagazinePreferences } from "@/types/editorial";
import { prepareIssueForDisplay } from "@/lib/content/prepare";
import type { IssueEnvelope } from "./models";
export interface IssueItemRecord {
  position: number;
  type: string;
  section: string;
  sourceId: string;
  externalId: string;
  originalUrl: string;
  snapshot: unknown;
}
export interface IssueRecord {
  id: string;
  issue_date: string;
  issue_number: number;
  created_at: string;
  preferences_snapshot: UserMagazinePreferences;
  composition: {
    sections: MagazineIssue["sections"];
    fallback: boolean;
    partial: boolean;
    loadedCount: number;
  };
}
export function serializeIssue(envelope: IssueEnvelope) {
  const issue = prepareIssueForDisplay(envelope.issue);
  const entries: IssueItemRecord[] = [];
  for (const story of issue.stories)
    entries.push({
      position: entries.length,
      type: "externalArticle",
      section:
        issue.sections.find((s) => s.storyIds.includes(story.id))?.id ?? "lead",
      sourceId: story.source.id,
      externalId: story.id,
      originalUrl: story.url,
      snapshot: story,
    });
  for (const item of issue.culturalItems)
    entries.push({
      position: entries.length,
      type:
        "mediaType" in item
          ? String(item.mediaType)
          : "pageId" in item
            ? "wikipediaDiscovery"
            : "objectId" in item
              ? "artwork"
              : "legacyCultural",
      section: item.kind,
      sourceId: item.source.id,
      externalId:
        "providerId" in item
          ? String(item.providerId)
          : "pageId" in item
            ? String(item.pageId)
            : "objectId" in item
              ? String(item.objectId)
              : item.id,
      originalUrl: item.originalUrl,
      snapshot: persistenceSnapshot(item),
    });
  for (const event of issue.onThisDay ?? [])
    entries.push({
      position: entries.length,
      type: "history",
      section: "on-this-day",
      sourceId: "wikipedia",
      externalId: event.id,
      originalUrl: event.sourceUrl,
      snapshot: event,
    });
  return {
    preferences: envelope.preferences,
    composition: {
      sections: issue.sections,
      fallback: envelope.fallback,
      partial: envelope.partial,
      loadedCount: envelope.loadedCount,
    },
    entries,
  };
}
export function reconstructIssue(
  record: IssueRecord,
  rows: { position: number; item_type: string; snapshot: unknown }[],
): IssueEnvelope {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const issue: MagazineIssue = {
    id: record.id,
    number: String(record.issue_number).padStart(3, "0"),
    date: record.issue_date,
    sections: record.composition.sections,
    stories: sorted
      .filter((r) => r.item_type === "externalArticle")
      .map((r) => r.snapshot) as MagazineIssue["stories"],
    culturalItems: sorted
      .filter((r) => !["externalArticle", "history"].includes(r.item_type))
      .map((r) => r.snapshot) as MagazineIssue["culturalItems"],
    onThisDay: sorted
      .filter((r) => r.item_type === "history")
      .map((r) => r.snapshot) as MagazineIssue["onThisDay"],
  };
  return {
    ...record.composition,
    issue: prepareIssueForDisplay(issue),
    preferences: record.preferences_snapshot,
    createdAt: record.created_at,
  };
}
