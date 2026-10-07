import type { ContentPolicy } from "@/types/editorial";
export const publisherPolicy: ContentPolicy = Object.freeze({
  destination: "external",
  canDisplayTitle: true,
  canDisplayAuthor: true,
  canDisplayDate: true,
  canDisplayExcerpt: false,
  canDisplayImage: false,
  canDisplayFullText: false,
});
export const wikipediaPolicy: ContentPolicy = Object.freeze({
  destination: "internal",
  canDisplayTitle: true,
  canDisplayAuthor: true,
  canDisplayDate: true,
  canDisplayExcerpt: true,
  canDisplayImage: true,
  canDisplayFullText: true,
  license: "CC BY-SA 4.0; images require separately verified Commons licenses",
});
export const metPolicy: ContentPolicy = Object.freeze({
  destination: "internal",
  canDisplayTitle: true,
  canDisplayAuthor: true,
  canDisplayDate: true,
  canDisplayExcerpt: true,
  canDisplayImage: true,
  canDisplayFullText: false,
  license: "CC0, qualifying Open Access/public-domain objects only",
});
export const commonsPolicy: ContentPolicy = Object.freeze({
  ...wikipediaPolicy,
  canDisplayFullText: false,
  license: "Individually verified CC BY, CC BY-SA, CC0 or public domain",
});
// Owned fictional fixtures, never a grant for a real publisher or user-supplied source.
export const mockPolicy: ContentPolicy = Object.freeze({
  ...publisherPolicy,
  canDisplayImage: true,
  license: "Owned demo headlines; separately licensed Unsplash images",
});
