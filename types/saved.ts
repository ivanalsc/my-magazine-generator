import type { FilmPick, TvPick, BookPick, AlbumPick } from "./pick";
import type { EditorialStory, CulturalItem } from "./editorial";
import type { WikipediaDiscovery, MuseumArtwork } from "./cultural";
interface SavedBase {
  key: string;
  savedAt: string;
}
export type SavedItem =
  | (SavedBase & { kind: "film"; item: FilmPick })
  | (SavedBase & { kind: "tv"; item: TvPick })
  | (SavedBase & { kind: "book"; item: BookPick })
  | (SavedBase & { kind: "album"; item: AlbumPick })
  | (SavedBase & { kind: "externalArticle"; item: EditorialStory })
  | (SavedBase & { kind: "wikipediaDiscovery"; item: WikipediaDiscovery })
  | (SavedBase & { kind: "artwork"; item: MuseumArtwork })
  | (SavedBase & { kind: "legacyCultural"; item: CulturalItem });
