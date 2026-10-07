import {
  publisherPolicy,
  wikipediaPolicy,
  metPolicy,
} from "@/lib/content/policies";
import type { Interest, Source } from "@/types/editorial";
export const interests: Interest[] = [
  { id: "art", name: "Art & Culture" },
  { id: "design", name: "Design" },
  { id: "creativity", name: "Creativity" },
  { id: "music", name: "Music" },
  { id: "books", name: "Books & Literature" },
  { id: "science", name: "Science" },
  { id: "technology", name: "Technology" },
  { id: "architecture", name: "Architecture" },
  { id: "travel", name: "Travel" },
  { id: "history", name: "History" },
  { id: "psychology", name: "Psychology" },
  { id: "ideas", name: "Ideas" },
  { id: "photography", name: "Photography" },
  { id: "film", name: "Film" },
  { id: "food", name: "Food" },
  { id: "nature", name: "Nature" },
];
// Temporarily hidden until editorial coverage improves. Keep the full taxonomy
// above for parsing existing preferences and provider mappings.
export const selectableInterests = interests.filter(
  ({ id }) => id !== "travel" && id !== "food",
);
function publication(
  id: string,
  name: string,
  websiteUrl: string,
  categories: string[],
  description: string,
  sourceType: Source["sourceType"] = "rss",
  disposition: "external" | "reusable" = "external",
): Source {
  return {
    id,
    slug: id,
    name,
    websiteUrl,
    categories,
    description,
    sourceType,
    contentPolicy:
      disposition === "external"
        ? publisherPolicy
        : sourceType === "wikipedia"
          ? wikipediaPolicy
          : metPolicy,
  };
}
// Selectable catalog. Connection status and verified feeds live in lib/sources/registry.ts.
export const sourceCatalog: Source[] = [
  publication(
    "rolling-stone",
    "Rolling Stone",
    "https://www.rollingstone.com",
    ["music", "art"],
    "Music · Culture",
  ),
  publication(
    "bandcamp-daily",
    "Bandcamp Daily",
    "https://daily.bandcamp.com",
    ["music"],
    "Music · Discovery",
  ),
  publication(
    "pitchfork",
    "Pitchfork",
    "https://pitchfork.com",
    ["music"],
    "Music",
  ),
  publication(
    "stereogum",
    "Stereogum",
    "https://www.stereogum.com",
    ["music"],
    "Music",
  ),
  publication(
    "its-nice-that",
    "It’s Nice That",
    "https://www.itsnicethat.com",
    ["design", "creativity", "photography"],
    "Design · Creativity",
  ),
  publication(
    "creative-boom",
    "Creative Boom",
    "https://www.creativeboom.com",
    ["design", "creativity", "art"],
    "Design · Creativity",
  ),
  publication(
    "designboom",
    "Designboom",
    "https://www.designboom.com",
    ["design", "architecture"],
    "Design · Architecture",
  ),
  publication(
    "hyperallergic",
    "Hyperallergic",
    "https://hyperallergic.com",
    ["art"],
    "Art · Culture",
  ),
  publication(
    "smithsonian",
    "Smithsonian Magazine",
    "https://www.smithsonianmag.com",
    ["art", "science", "history", "nature", "travel"],
    "Culture · Science · History",
  ),
  publication(
    "public-domain-review",
    "The Public Domain Review",
    "https://publicdomainreview.org",
    ["art", "history", "books"],
    "Art · History",
  ),
  publication(
    "aeon",
    "Aeon",
    "https://aeon.co",
    ["ideas", "science", "psychology"],
    "Ideas · Philosophy · Science",
  ),
  publication(
    "nautilus",
    "Nautilus",
    "https://nautil.us",
    ["science", "ideas", "nature"],
    "Science · Ideas",
  ),
  publication(
    "archdaily",
    "ArchDaily",
    "https://www.archdaily.com",
    ["architecture", "design"],
    "Architecture",
  ),
  publication(
    "hacker-news",
    "Hacker News",
    "https://news.ycombinator.com",
    ["technology"],
    "Technology",
    "api",
  ),
  publication(
    "wikipedia",
    "Wikipedia",
    "https://en.wikipedia.org",
    ["ideas", "history", "science"],
    "Knowledge · Discovery",
    "wikipedia",
    "reusable",
  ),
  publication(
    "met",
    "The Metropolitan Museum of Art",
    "https://www.metmuseum.org",
    ["art", "history"],
    "Art · Open Collection",
    "museum",
    "reusable",
  ),
];
export const sourceGroups = [
  {
    id: "music",
    name: "Music",
    interestIds: ["music"],
    sourceIds: ["rolling-stone", "bandcamp-daily", "pitchfork", "stereogum"],
  },
  {
    id: "design",
    name: "Design & creativity",
    interestIds: ["design", "creativity", "photography"],
    sourceIds: ["its-nice-that", "creative-boom", "designboom"],
  },
  {
    id: "culture",
    name: "Art & culture",
    interestIds: ["art", "history", "books", "film", "travel"],
    sourceIds: ["hyperallergic", "smithsonian", "public-domain-review"],
  },
  {
    id: "ideas",
    name: "Ideas & science",
    interestIds: ["ideas", "science", "psychology", "nature", "food"],
    sourceIds: ["aeon", "nautilus"],
  },
  {
    id: "architecture",
    name: "Architecture",
    interestIds: ["architecture"],
    sourceIds: ["archdaily"],
  },
  {
    id: "technology",
    name: "Technology",
    interestIds: ["technology"],
    sourceIds: ["hacker-news"],
  },
  {
    id: "discovery",
    name: "Cultural discovery",
    interestIds: ["art", "ideas", "history"],
    sourceIds: ["wikipedia", "met"],
  },
];
