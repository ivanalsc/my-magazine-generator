import type { CulturalItem, EditorialImage } from "./editorial";
export interface LicensedImage extends EditorialImage {
  licenseUrl: string;
  attribution: string;
  originalFileUrl: string;
}
export interface WikipediaDiscovery extends CulturalItem {
  kind: "rabbit-hole";
  pageId: number;
  revisionId?: number;
  extract: string;
  textLicense: { name: string; url: string };
  image?: LicensedImage;
}
export interface MuseumArtwork extends CulturalItem {
  kind: "artwork";
  objectId: number;
  isPublicDomain: true;
  medium: string;
  department: string;
  culture?: string;
  dimensions?: string;
  creditLine?: string;
  accessionNumber?: string;
}
export interface HistoricalEvent {
  id: string;
  year: number;
  text: string;
  sourceUrl: string;
  relatedPage?: {
    pageId: number;
    title: string;
    internalUrl: string;
    originalUrl: string;
  };
}
export interface CulturalBundle {
  rabbitHole?: WikipediaDiscovery;
  artwork?: MuseumArtwork;
  events: HistoricalEvent[];
}
