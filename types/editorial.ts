import type { HistoricalEvent } from "./cultural";
export type SourceType =
  "rss" | "substack" | "wikipedia" | "wikimedia" | "museum" | "api" | "custom";
export interface ContentPolicy {
  destination: "external" | "internal";
  canDisplayTitle: boolean;
  canDisplayAuthor: boolean;
  canDisplayDate: boolean;
  canDisplayExcerpt: boolean;
  canDisplayImage: boolean;
  canDisplayFullText: boolean;
  license?: string;
}
export interface Interest {
  id: string;
  name: string;
}
export interface Source {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  feedUrl?: string;
  sourceType: SourceType;
  contentPolicy: ContentPolicy;
  categories: string[];
  description?: string;
  license?: { name: string; url: string };
  isMock?: boolean;
}
export interface UserMagazinePreferences {
  version: 1;
  interests: string[];
  sources: string[];
  customSources: Source[];
}
export interface EditorialImage {
  src: string;
  alt: string;
  credit: string;
  creditUrl: string;
  license?: string;
}
export interface EditorialStory {
  id: string;
  title: string;
  excerpt?: string;
  url: string;
  image?: EditorialImage;
  source: Source;
  sourceType: SourceType;
  contentPolicy: "external";
  category: string;
  interestIds: string[];
  publishedAt?: string;
  readingTime?: number;
  author?: string;
}
export interface CulturalItem {
  id: string;
  kind: "artwork" | "rabbit-hole" | "history" | "cultural-pick";
  title: string;
  description?: string;
  image?: EditorialImage;
  source: Source;
  contentPolicy: "reusable";
  originalUrl: string;
  internalUrl: string;
  artist?: string;
  year?: string;
  attribution: string;
}
export interface IssueSection {
  id: string;
  title: string;
  storyIds: string[];
  culturalItemIds: string[];
  interestIds: string[];
}
export interface MagazineIssue {
  id: string;
  date: string;
  number: string;
  stories: EditorialStory[];
  culturalItems: CulturalItem[];
  sections: IssueSection[];
  onThisDay?: HistoricalEvent[];
}
