import type { CulturalItem } from "./editorial";
interface PickBase extends CulturalItem {
  kind: "cultural-pick";
  creators: string[];
  topics: string[];
  interestIds: string[];
  provenance: {
    provider: "tmdb" | "openlibrary" | "musicbrainz";
    fetchedAt: string;
    termsUrl: string;
    expiresAt?: string;
  };
}
export interface FilmPick extends PickBase {
  mediaType: "film";
  providerId: number;
}
export interface TvPick extends PickBase {
  mediaType: "tv";
  providerId: number;
}
export interface BookPick extends PickBase {
  mediaType: "book";
  providerId: string;
  coverId?: number;
}
export interface AlbumPick extends PickBase {
  mediaType: "album";
  providerId: string;
  primaryType: "Album";
}
export type CulturalPick = FilmPick | TvPick | BookPick | AlbumPick;
