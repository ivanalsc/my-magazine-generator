import type {
  EditorialStory,
  CulturalItem,
  MagazineIssue,
  UserMagazinePreferences,
} from "@/types/editorial";
import { balancedSelection, itemIdentity } from "./selection";
import { matchesPreferences, isOutside } from "@/lib/buildMagazineIssue";
import { prepareIssueForDisplay } from "@/lib/content/prepare";
export function refreshStorySection(
  issue: MagazineIssue,
  sectionId: string,
  candidates: EditorialStory[],
  preferences: UserMagazinePreferences,
  recent: string[],
  counter: number,
): MagazineIssue | null {
  const section = issue.sections.find((s) => s.id === sectionId);
  if (!section || sectionId === "lead" || !section.storyIds.length) return null;
  const matching = candidates.filter((s) =>
    sectionId === "outside"
      ? isOutside(s, preferences)
      : matchesPreferences(s, preferences) &&
        (sectionId === "publications"
          ? !s.interestIds.some((id) => preferences.interests.includes(id))
          : s.interestIds.includes(sectionId)),
  );
  const selected = balancedSelection(
    matching,
    preferences,
    section.storyIds.length,
    {
      recent,
      exclude: issue.stories.map(itemIdentity),
      seed: `${issue.date}:${sectionId}:${counter}`,
      initial: issue.stories
        .filter((s) => !section.storyIds.includes(s.id))
        .map((story) => ({
          story,
          category:
            issue.sections.find((s) => s.storyIds.includes(story.id))?.id ??
            "publications",
        })),
    },
  );
  // Keep the existing section if its size cannot be maintained. No partial deletion.
  if (selected.length < section.storyIds.length) return null;
  const replacement = selected.map((s) => s.story);
  return prepareIssueForDisplay({
    ...issue,
    stories: [
      ...issue.stories.filter((s) => !section.storyIds.includes(s.id)),
      ...replacement,
    ],
    sections: issue.sections.map((s) =>
      s.id === sectionId ? { ...s, storyIds: replacement.map((s) => s.id) } : s,
    ),
  });
}
export function refreshCulturalItem<T extends CulturalItem>(
  issue: MagazineIssue,
  kind: "rabbit-hole" | "artwork",
  replacement: T | null | undefined,
): MagazineIssue | null {
  const current = issue.culturalItems.find((i) => i.kind === kind);
  if (
    !current ||
    !replacement ||
    replacement.kind !== kind ||
    itemIdentity(current) === itemIdentity(replacement) ||
    (kind === "artwork" &&
      (!replacement.image || replacement.image.src === current.image?.src))
  )
    return null;
  return prepareIssueForDisplay({
    ...issue,
    culturalItems: issue.culturalItems.map((i) =>
      i.kind === kind ? replacement : i,
    ),
  });
}
