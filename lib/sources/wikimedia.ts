import { unstable_cache } from "next/cache";
import { openApiJson } from "./openApi";
import { seededOrder } from "./selection";
import type { HistoricalEvent } from "@/types/cultural";
interface RawEvent {
  year: number;
  text: string;
  pages?: {
    pageid: number;
    titles?: { normalized: string };
    title: string;
    description?: string;
    type?: string;
  }[];
}
export function selectHistoricalEvents(
  raw: RawEvent[],
  date: string,
): HistoricalEvent[] {
  const seen = new Set<string>();
  const usable = raw.filter((event) => {
    if (
      !Number.isInteger(event.year) ||
      typeof event.text !== "string" ||
      event.text.length < 30 ||
      event.text.length > 420 ||
      !event.pages?.length
    )
      return false;
    const key = event.text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ranked = seededOrder(
    usable,
    date,
    (event) => `${event.year}:${event.text}`,
  ).sort((a, b) => {
    const cultural = (event: RawEvent) =>
      Number(
        event.pages?.some((page) =>
          /artist|art |painting|museum|music|composer|film|writer|novel|book|architect|scientist|invention|discovery|university|explorer/i.test(
            page.description ?? "",
          ),
        ),
      );
    return cultural(b) - cultural(a);
  });
  return ranked.slice(0, 3).map((event) => {
    const page = event.pages?.find(
      (page) => page.pageid > 0 && page.type !== "disambiguation",
    );
    return {
      id: `history:${event.year}:${event.text}`,
      year: event.year,
      text: event.text,
      sourceUrl: `https://en.wikipedia.org/wiki/${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(" ", "_")}`,
      relatedPage: page
        ? {
            pageId: page.pageid,
            title: page.titles?.normalized ?? page.title.replaceAll("_", " "),
            internalUrl: `/explore/wikipedia/${page.pageid}`,
            originalUrl: `https://en.wikipedia.org/?curid=${page.pageid}`,
          }
        : undefined,
    };
  });
}
export const getOnThisDay = unstable_cache(
  async (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new Error("Invalid issue date.");
    const data = await openApiJson<{ events: RawEvent[] }>(
      `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${date.slice(5, 7)}/${date.slice(8, 10)}`,
    );
    return selectHistoricalEvents(data.events ?? [], date);
  },
  ["on-this-day-v1"],
  { revalidate: 86400 },
);
