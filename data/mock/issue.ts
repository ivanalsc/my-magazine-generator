import { mockPolicy, wikipediaPolicy, metPolicy } from "@/lib/content/policies";
import type {
  EditorialStory,
  CulturalItem,
  MagazineIssue,
  EditorialImage,
  Source,
} from "@/types/editorial";
const photo = (name: string, alt: string): EditorialImage => ({
  src: `/images/${name}.jpg`,
  alt,
  credit: "Unsplash",
  creditUrl: "https://unsplash.com/license",
  license: "Unsplash License",
});
const publisher = (name: string): Source => ({
  id: name.toLowerCase().replaceAll(" ", "-"),
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  categories: [],
  sourceType: "rss",
  websiteUrl: "https://example.com",
  contentPolicy: mockPolicy,
  isMock: true,
});
function article(
  id: string,
  title: string,
  publication: string,
  category: string,
  image?: EditorialImage,
  readingTime?: number,
): EditorialStory {
  const source = publisher(publication);
  return {
    id,
    title,
    source,
    sourceType: source.sourceType,
    contentPolicy: "external",
    category,
    interestIds: category.toLowerCase().includes("creativity")
      ? ["creativity", "ideas"]
      : category.toLowerCase().includes("design")
        ? ["design"]
        : category.toLowerCase().includes("books")
          ? ["books", "travel"]
          : category.toLowerCase().includes("art")
            ? ["art"]
            : category.toLowerCase().includes("music")
              ? ["music"]
              : ["science", "nature"],
    publishedAt: "2026-10-06",
    url: `https://example.com/#${id}`,
    image,
    readingTime,
  };
}
export const stories: EditorialStory[] = [
  article(
    "lead",
    "The quiet art of paying attention",
    "The Observant",
    "Ideas & creativity",
    photo(
      "lead",
      "Sunlight falling on a quiet interior with sculptural furniture",
    ),
    8,
  ),
  article(
    "objects",
    "Ordinary objects, extraordinary possibilities",
    "Form & Field",
    "Design",
    photo("design", "An upholstered white chair against a pale background"),
    6,
  ),
  article(
    "notebook",
    "In praise of the unfinished notebook",
    "Small Practice",
    "Creativity",
    undefined,
    4,
  ),
  article(
    "type",
    "A typeface with a little more humanity",
    "Letterpress Journal",
    "Design",
    undefined,
    5,
  ),
  article(
    "museum",
    "A museum is also a place to get lost",
    "The Culture Almanac",
    "Art & culture",
    photo(
      "museum",
      "Abstract marbled paint in yellow, black, violet, and white",
    ),
    7,
  ),
  article(
    "books",
    "The bookshops that make a city",
    "Margin Notes",
    "Books & literature",
    undefined,
    9,
  ),
  article(
    "listening",
    "Listening to a city after dark",
    "Side B Journal",
    "Music",
    {
      ...photo("music", "A record player and vinyl albums on a wooden shelf"),
      credit: "Jonas Leupe / Unsplash",
      creditUrl:
        "https://unsplash.com/photos/a-record-player-sitting-on-top-of-a-wooden-shelf-xBBUZt47WEg",
    },
    6,
  ),
  article(
    "silence",
    "The space between the notes",
    "Low Volume",
    "Music",
    undefined,
    5,
  ),
  article(
    "sleeves",
    "When the record sleeve becomes the canvas",
    "Side B Journal",
    "Music",
    undefined,
    4,
  ),
  article(
    "fungi",
    "An entire world beneath our feet",
    "The Field Notebook",
    "Science",
    photo("nature", "Brown mushrooms scattered on a textured grey surface"),
    8,
  ),
];
const wikipedia: Source = {
  id: "wikipedia",
  slug: "wikipedia",
  categories: ["ideas", "history"],
  name: "Wikipedia",
  sourceType: "wikipedia",
  websiteUrl: "https://en.wikipedia.org",
  contentPolicy: wikipediaPolicy,
  license: {
    name: "CC BY-SA 4.0",
    url: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
};
const met: Source = {
  id: "met",
  slug: "met",
  categories: ["art", "history"],
  name: "The Metropolitan Museum of Art",
  sourceType: "museum",
  websiteUrl: "https://www.metmuseum.org",
  contentPolicy: metPolicy,
  license: {
    name: "Public domain / CC0",
    url: "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
  },
};
export const culturalItems: CulturalItem[] = [
  {
    id: "voynich",
    kind: "rabbit-hole",
    title: "The Voynich Manuscript",
    description:
      'An illustrated codex, hand-written in an undeciphered script referred to as "Voynichese".',
    source: wikipedia,
    contentPolicy: "reusable",
    originalUrl: "https://en.wikipedia.org/wiki/Voynich_manuscript",
    internalUrl: "/discover/voynich",
    attribution: "Wikipedia contributors. Source excerpt; CC BY-SA 4.0.",
    image: {
      src: "/images/voynich.jpg",
      alt: "Botanical illustrations and unknown script on a page of the Voynich manuscript",
      credit: "Beinecke Rare Book and Manuscript Library, Yale University",
      creditUrl:
        "https://commons.wikimedia.org/wiki/File:Voynich_Manuscript_(4).jpg",
      license: "Public domain",
    },
  },
  {
    id: "harvesters",
    kind: "artwork",
    title: "The Harvesters",
    artist: "Pieter Bruegel the Elder",
    year: "1565",
    source: met,
    contentPolicy: "reusable",
    originalUrl: "https://www.metmuseum.org/art/collection/search/435809",
    internalUrl: "/discover/harvesters",
    attribution:
      "The Metropolitan Museum of Art. Rogers Fund, 1919. Object 19.164. Public domain / CC0.",
    image: {
      src: "/images/harvesters.jpg",
      alt: "Golden wheat fields, harvesting peasants, and workers resting beneath a tree in Bruegel’s The Harvesters",
      credit: "The Metropolitan Museum of Art",
      creditUrl: "https://www.metmuseum.org/art/collection/search/435809",
      license: "Public domain / CC0",
    },
  },
  {
    id: "jazz-singer",
    kind: "history",
    title: "The Jazz Singer opens",
    description:
      "Opening of The Jazz Singer, the first prominent “talkie” movie.",
    year: "1927",
    source: wikipedia,
    contentPolicy: "reusable",
    originalUrl: "https://en.wikipedia.org/wiki/October_6",
    internalUrl: "/discover/jazz-singer",
    attribution:
      "Wikipedia contributors, October 6. Source excerpt; CC BY-SA 4.0.",
  },
  {
    id: "cyanotype",
    kind: "rabbit-hole",
    title: "Cyanotype",
    description:
      "It produces a monochrome, blue-coloured print on a range of supports.",
    source: wikipedia,
    contentPolicy: "reusable",
    originalUrl: "https://en.wikipedia.org/wiki/Cyanotype",
    internalUrl: "/discover/cyanotype",
    attribution: "Wikipedia contributors. Source excerpt; CC BY-SA 4.0.",
  },
];
export const mockIssue: MagazineIssue = {
  id: "2026-10-06",
  date: "2026-10-06",
  number: "001",
  stories,
  culturalItems,
  sections: [
    {
      id: "lead",
      interestIds: ["ideas", "creativity"],
      title: "The opening story",
      storyIds: ["lead"],
      culturalItemIds: [],
    },
    {
      id: "design",
      interestIds: ["design", "creativity"],
      title: "Design & creativity",
      storyIds: ["objects", "notebook", "type"],
      culturalItemIds: [],
    },
    {
      id: "culture",
      interestIds: ["art", "books", "photography", "film", "travel"],
      title: "Art & culture",
      storyIds: ["museum", "books"],
      culturalItemIds: ["cyanotype"],
    },
    {
      id: "rabbit-hole",
      interestIds: ["history", "ideas"],
      title: "Rabbit hole",
      storyIds: [],
      culturalItemIds: ["voynich"],
    },
    {
      id: "music",
      interestIds: ["music"],
      title: "Music",
      storyIds: ["listening", "silence", "sleeves"],
      culturalItemIds: [],
    },
    {
      id: "artwork",
      interestIds: ["art"],
      title: "Artwork of the day",
      storyIds: [],
      culturalItemIds: ["harvesters"],
    },
    {
      id: "history",
      interestIds: ["history"],
      title: "On this day",
      storyIds: [],
      culturalItemIds: ["jazz-singer"],
    },
    {
      id: "outside",
      interestIds: [],
      title: "Outside your bubble",
      storyIds: ["fungi"],
      culturalItemIds: [],
    },
  ],
};
