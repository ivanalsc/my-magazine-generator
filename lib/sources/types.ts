import type { Source, EditorialStory } from "@/types/editorial";
export interface FeedSource extends Source {
  enabled: boolean;
  status?: "ACTIVE" | "VERIFIED BUT DISABLED" | "UNAVAILABLE" | "UNVERIFIED";
  verification?: string;
}
export interface SourceResult {
  source: Source;
  stories: EditorialStory[];
}
export interface SourceFailure {
  id: string;
  name: string;
  reason: string;
}
export interface AggregationResult {
  stories: EditorialStory[];
  failed: SourceFailure[];
  loaded: string[];
}
