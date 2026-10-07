import { interests } from "@/data/catalog";
import type { CulturalBundle } from "@/types/cultural";
import { deduplicateStories } from "./sources/deduplicate";
import { balancedSelection, itemIdentity } from "./editorial/selection";
import type {
  EditorialStory,
  MagazineIssue,
  UserMagazinePreferences,
  IssueSection,
} from "@/types/editorial";
export function matchesPreferences(
  story: EditorialStory,
  preferences: UserMagazinePreferences,
) {
  return (
    story.interestIds.some((id) => preferences.interests.includes(id)) ||
    preferences.sources.includes(story.source.id) ||
    preferences.customSources.some(
      (source) => source.feedUrl === story.source.feedUrl,
    )
  );
}
export function isOutside(
  story: EditorialStory,
  preferences: UserMagazinePreferences,
) {
  return (
    story.interestIds.length > 0 && !matchesPreferences(story, preferences)
  );
}
export function buildMagazineIssue({
  preferences,
  stories,
  date,
  culturalContent = { events: [] },
  recent = [],
}: {
  preferences: UserMagazinePreferences;
  stories: EditorialStory[];
  date: string;
  culturalContent?: CulturalBundle;
  recent?: string[];
}): MagazineIssue {
  const available = deduplicateStories(stories);
  const seed = `${date}:${[...preferences.interests].sort().join(",")}:${[...preferences.sources].sort().join(",")}`;
  const selected = balancedSelection(
    available.filter((s) => matchesPreferences(s, preferences)),
    preferences,
    10,
    { recent, seed },
  );
  const opening = selected.shift();
  const lead = opening?.story;
  const sections: IssueSection[] = [];
  for (const { story, category } of selected) {
    let section = sections.find((s) => s.id === category);
    if (!section) {
      section = {
        id: category,
        title:
          interests.find((i) => i.id === category)?.name ??
          "From your publications",
        storyIds: [],
        culturalItemIds: [],
        interestIds: category === "publications" ? [] : [category],
      };
      sections.push(section);
    }
    section.storyIds.push(story.id);
  }
  const outside = balancedSelection(
    available.filter((s) => isOutside(s, preferences)),
    preferences,
    1,
    {
      recent,
      seed: seed + ":outside",
      initial: opening ? [opening, ...selected] : [],
    },
  )[0]?.story;
  return {
    id: `issue-${date}`,
    date,
    number: date.replaceAll("-", ""),
    stories: [
      ...(lead ? [lead] : []),
      ...selected.map((s) => s.story),
      ...(outside ? [outside] : []),
    ],
    culturalItems: [culturalContent.rabbitHole, culturalContent.artwork].filter(
      (i): i is NonNullable<typeof i> => !!i,
    ),
    onThisDay: culturalContent.events.slice(0, 3),
    sections: [
      ...(lead
        ? [
            {
              id: "lead",
              title: "The opening story",
              storyIds: [lead.id],
              culturalItemIds: [],
              interestIds: lead.interestIds,
            },
          ]
        : []),
      ...sections,
      ...(outside
        ? [
            {
              id: "outside",
              title: "Outside your bubble",
              storyIds: [outside.id],
              culturalItemIds: [],
              interestIds: outside.interestIds,
            },
          ]
        : []),
    ],
  };
}
export { itemIdentity };
