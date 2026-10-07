import type { IssueEnvelope } from "@/lib/repositories/models";
import { parsePreferences } from "@/lib/preferences";
import { parseSaved } from "@/lib/storage/saved-parser";
import { prepareIssueForDisplay } from "@/lib/content/prepare";
export const GUEST_ISSUE_KEY = "my-magazine-generator:current-issue:v1";
export function parseGuestIssue(raw: unknown): IssueEnvelope | null {
  try {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as IssueEnvelope;
    const preferences = parsePreferences(JSON.stringify(value.preferences));
    const issue = value.issue;
    if (
      !preferences ||
      !issue ||
      typeof issue.id !== "string" ||
      typeof issue.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(issue.date) ||
      !Array.isArray(issue.stories) ||
      issue.stories.length > 15 ||
      !Array.isArray(issue.culturalItems) ||
      issue.culturalItems.length > 3 ||
      !Array.isArray(issue.sections) ||
      issue.sections.length > 18
    )
      return null;
    if (
      issue.culturalItems.filter((i) => i.kind === "cultural-pick").length >
        1 ||
      issue.culturalItems.some(
        (i) =>
          !/^https:\/\//.test(i.originalUrl) ||
          !/^https:\/\//.test(i.source.websiteUrl),
      )
    )
      return null;
    const entries = [
      ...issue.stories.map((item) => ({
        kind: "externalArticle",
        item,
        savedAt: "2026-01-01T00:00:00Z",
      })),
      ...issue.culturalItems.map((item) => ({
        kind:
          "mediaType" in item
            ? item.mediaType
            : "pageId" in item
              ? "wikipediaDiscovery"
              : "objectId" in item
                ? "artwork"
                : "legacyCultural",
        item,
        savedAt: "2026-01-01T00:00:00Z",
      })),
    ];
    const validated = parseSaved(
      JSON.stringify({ version: 2, items: entries }),
    );
    if (validated.length !== entries.length) return null;
    if (
      issue.onThisDay &&
      (!Array.isArray(issue.onThisDay) ||
        issue.onThisDay.length > 3 ||
        issue.onThisDay.some(
          (e) =>
            typeof e.id !== "string" ||
            typeof e.text !== "string" ||
            typeof e.year !== "number" ||
            !/^https:\/\/en.wikipedia.org\//.test(e.sourceUrl),
        ))
    )
      return null;
    if (
      issue.sections.some(
        (s) =>
          typeof s.id !== "string" ||
          !Array.isArray(s.storyIds) ||
          !Array.isArray(s.interestIds) ||
          !Array.isArray(s.culturalItemIds) ||
          s.storyIds.some(
            (id) => !issue.stories.some((story) => story.id === id),
          ),
      )
    )
      return null;
    return {
      ...value,
      preferences,
      issue: prepareIssueForDisplay({
        ...issue,
        stories: validated
          .filter((e) => e.kind === "externalArticle")
          .map((e) => e.item) as typeof issue.stories,
        culturalItems: validated
          .filter((e) => e.kind !== "externalArticle")
          .map((e) => e.item) as typeof issue.culturalItems,
      }),
      recentSelections: Array.isArray(value.recentSelections)
        ? value.recentSelections
            .filter(
              (id): id is string => typeof id === "string" && id.length <= 2048,
            )
            .slice(-300)
        : [],
      revision:
        Number.isInteger(value.revision) && value.revision! >= 0
          ? value.revision
          : 0,
    };
  } catch {
    return null;
  }
}
