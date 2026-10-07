import type { DiscoverySelection } from "./selection";
import { getRabbitHole } from "./wikipedia";
import { getOnThisDay } from "./wikimedia";
import { getArtworkForIssue } from "./met";
import type { CulturalBundle } from "@/types/cultural";
export async function getCulturalContent(
  date: string,
  interests: string[],
  providers = {
    rabbitHole: getRabbitHole,
    artwork: getArtworkForIssue,
    onThisDay: getOnThisDay,
  },
  selection: DiscoverySelection = {},
) {
  const [wiki, met, history] = await Promise.allSettled([
    providers.rabbitHole(date, [...interests].sort(), selection),
    providers.artwork(date, [...interests].sort(), selection),
    providers.onThisDay(date),
  ]);
  const content: CulturalBundle = {
    rabbitHole:
      wiki.status === "fulfilled" ? (wiki.value ?? undefined) : undefined,
    artwork: met.status === "fulfilled" ? (met.value ?? undefined) : undefined,
    events: history.status === "fulfilled" ? history.value : [],
  };
  const failed = [
    ...(!content.rabbitHole ? ["wikipedia"] : []),
    ...(!content.artwork ? ["met"] : []),
    ...(!content.events.length ? ["wikimedia"] : []),
  ];
  return { content, failed };
}
