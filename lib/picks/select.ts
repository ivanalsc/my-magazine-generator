import { pickDiagnostic, safePickFailure } from "./diagnostics";
import type { CulturalPick } from "@/types/pick";
import { eligibleTypes, mapping, validPick, type PickType } from "./model";
import { isDiscoveryPick } from "./quality";
import {
  seededOrder,
  discoveryOrder,
  type DiscoverySelection,
} from "@/lib/sources/selection";

export function identityType(id: string): PickType | undefined {
  if (id.startsWith("tmdb:movie:")) return "film";
  if (id.startsWith("tmdb:tv:")) return "tv";
  if (id.startsWith("openlibrary:")) return "book";
  if (id.startsWith("musicbrainz:")) return "album";
}
const group = (type: PickType): string =>
  type === "film" || type === "tv" ? "screen" : type;

// Decide format before consulting any pool. Film/TV share one category weight.
export function orderedPickTypes(
  date: string,
  interests: string[],
  selection: DiscoverySelection = {},
): PickType[] {
  const ids = [...new Set(interests)].sort();
  const eligible = eligibleTypes(ids);
  const recent = [...new Set(selection.recent ?? [])]
    .map(identityType)
    .filter((t): t is PickType => !!t);
  const current = (selection.exclude ?? [])
    .map(identityType)
    .filter((t): t is PickType => !!t);
  const groups = [...new Set(eligible.map(group))];
  const direct = new Set(
    ids.flatMap((id) =>
      id === "books"
        ? ["book"]
        : id === "music"
          ? ["album"]
          : id === "film"
            ? ["screen"]
            : [],
    ),
  );
  const affinity = (g: string) =>
    ids.reduce((sum, id) => {
      const mapped = [...new Set((mapping[id] ?? []).map(group))];
      return sum + (mapped.includes(g) ? 1 / mapped.length : 0);
    }, 0);
  const historyCount = (g: string) =>
    recent.filter((t) => group(t) === g).length;
  const orderedGroups = seededOrder(
    groups,
    `${date}:${ids.join(",")}:type:${selection.counter ?? 0}`,
    (g) => g,
  ).sort(
    (a, b) =>
      Number(current.some((t) => group(t) === a)) -
        Number(current.some((t) => group(t) === b)) ||
      historyCount(a) - historyCount(b) ||
      Number(!direct.has(a)) - Number(!direct.has(b)) ||
      affinity(b) - affinity(a),
  );
  return orderedGroups.flatMap((g) =>
    seededOrder(
      eligible.filter((t) => group(t) === g),
      `${date}:${ids.join(",")}:format:${selection.counter ?? 0}`,
      (t) => t,
    ).sort(
      (a, b) =>
        Number(current.includes(a)) - Number(current.includes(b)) ||
        recent.filter((t) => t === a).length -
          recent.filter((t) => t === b).length,
    ),
  );
}
export async function selectCulturalPick(
  date: string,
  interests: string[],
  selection: DiscoverySelection = {},
  providers?: {
    pool: (type: PickType, ids: string[]) => Promise<CulturalPick[]>;
    detail?: (pick: CulturalPick) => Promise<CulturalPick | null>;
  },
): Promise<CulturalPick | null> {
  const api =
    providers ??
    (await import("./providers").then((p) => ({
      pool: p.getPickPool,
      detail: async (item: CulturalPick) =>
        item.mediaType === "film" || item.mediaType === "tv"
          ? p.getPickById(item.mediaType, String(item.providerId))
          : item,
    })));
  if (!api) return null;
  const repeated: CulturalPick[] = [];
  const complete = async (candidate: CulturalPick) => {
    try {
      const full = api.detail ? await api.detail(candidate) : candidate;
      return full &&
        full.id === candidate.id &&
        full.mediaType === candidate.mediaType &&
        isDiscoveryPick(full)
        ? { ...full, interestIds: candidate.interestIds }
        : null;
    } catch {
      return null;
    }
  };
  for (const type of orderedPickTypes(date, interests, selection)) {
    try {
      const distinct = [
        ...new Map(
          (await api.pool(type, [...new Set(interests)].sort()))
            .filter((p) => p.mediaType === type && validPick(p))
            .map((p) => [p.id, p]),
        ).values(),
      ];
      const pool = discoveryOrder(
        distinct,
        `${date}:${[...new Set(interests)].sort().join(",")}`,
        (p) => p.id,
        selection,
      );
      repeated.push(
        ...pool.filter((p) => selection.recent?.includes(p.id)).slice(0, 3),
      );
      for (const candidate of pool
        .filter((p) => !selection.recent?.includes(p.id))
        .slice(0, 3)) {
        const full = await complete(candidate);
        if (full) return full;
      }
    } catch (error) {
      pickDiagnostic(type, {
        outcome: "failure",
        reason: safePickFailure(error),
      });
    }
  }
  for (const candidate of repeated) {
    const full = await complete(candidate);
    if (full) return full;
  }
  return null;
}
