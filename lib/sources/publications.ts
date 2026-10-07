import { sourceGroups } from "@/data/catalog";
import { enabledSources } from "./registry";
/** Optional publications only. Native discoveries are included independently. */
export const publicationGroups = sourceGroups
  .map((group) => ({
    ...group,
    sourceIds: group.sourceIds.filter((id) =>
      enabledSources.some((source) => source.id === id),
    ),
  }))
  .filter((group) => group.sourceIds.length > 0);
