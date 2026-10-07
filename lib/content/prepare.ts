import { cleanPick } from "@/lib/picks/model";
import type { CulturalPick } from "@/types/pick";
import { stories as ownedDemoStories } from "@/data/mock/issue";
import { sourceCatalog } from "@/data/catalog";
import { publisherPolicy } from "./policies";
import type {
  ContentPolicy,
  EditorialStory,
  MagazineIssue,
  CulturalItem,
} from "@/types/editorial";
export function policyForSource(id: string): ContentPolicy {
  return (
    sourceCatalog.find((source) => source.id === id)?.contentPolicy ??
    publisherPolicy
  );
}
// Whitelist, rather than spreading parser objects: article bodies can never escape here.
export function prepareStoryForDisplay(
  story: EditorialStory,
  policy: ContentPolicy = ownedDemoStories.find(
    (item) =>
      item.id === story.id &&
      item.title === story.title &&
      item.url === story.url &&
      item.image?.src === story.image?.src,
  )?.source.contentPolicy ?? policyForSource(story.source.id),
): EditorialStory {
  return {
    id: story.id,
    title: policy.canDisplayTitle
      ? story.title
      : "Story at original publication",
    url: story.url,
    source: {
      id: story.source.id,
      name: story.source.name,
      slug: story.source.slug,
      websiteUrl: story.source.websiteUrl,
      feedUrl: story.source.feedUrl,
      sourceType: story.source.sourceType,
      categories: story.source.categories,
      isMock: story.source.isMock,
      contentPolicy: {
        ...policy,
        destination: "external",
        canDisplayFullText: false,
      },
    },
    sourceType: story.sourceType,
    contentPolicy: "external",
    category: story.category,
    interestIds: story.interestIds,
    ...(policy.canDisplayAuthor && story.author
      ? { author: story.author }
      : {}),
    ...(policy.canDisplayDate && story.publishedAt
      ? { publishedAt: story.publishedAt }
      : {}),
    ...(policy.canDisplayExcerpt && story.excerpt
      ? { excerpt: story.excerpt }
      : {}),
    ...(policy.canDisplayImage && story.image ? { image: story.image } : {}),
    ...(story.readingTime ? { readingTime: story.readingTime } : {}),
  };
}
export function prepareIssueForDisplay(issue: MagazineIssue): MagazineIssue {
  return {
    ...issue,
    stories: issue.stories.map((story) => prepareStoryForDisplay(story)),
    culturalItems: issue.culturalItems.map((item) =>
      prepareCulturalForDisplay(item),
    ),
  };
}

export function prepareCulturalForDisplay<T extends CulturalItem>(item: T): T {
  if (item.kind === "cultural-pick")
    return cleanPick(item as unknown as CulturalPick) as unknown as T;
  const source = sourceCatalog.find((source) => source.id === item.source.id);
  const result = {
    id: item.id,
    kind: item.kind,
    title: item.title,
    description: item.description,
    image: item.image,
    source: source ? { ...source, license: item.source.license } : item.source,
    contentPolicy: "reusable",
    originalUrl: item.originalUrl,
    internalUrl: item.internalUrl,
    artist: item.artist,
    year: item.year,
    attribution: item.attribution,
  };
  if ("pageId" in item)
    Object.assign(result, {
      pageId: item.pageId,
      revisionId: "revisionId" in item ? item.revisionId : undefined,
      extract: "extract" in item ? item.extract : undefined,
      textLicense: "textLicense" in item ? item.textLicense : undefined,
    });
  if ("objectId" in item)
    for (const key of [
      "objectId",
      "isPublicDomain",
      "medium",
      "department",
      "culture",
      "dimensions",
      "creditLine",
      "accessionNumber",
    ] as const)
      if (key in item) Object.assign(result, { [key]: item[key as keyof T] });
  return result as T;
}
