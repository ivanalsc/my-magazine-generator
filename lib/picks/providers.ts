import { validPick } from "./model";
import { loadBookPool } from "./books";
import { pickDiagnostic } from "./diagnostics";
import { unstable_cache } from "next/cache";
import { providerJson, CACHE_SECONDS } from "./request";
import { normalizeBook, normalizeAlbum, normalizeTmdb } from "./normalize";
import { seededOrder } from "@/lib/sources/selection";
import type { CulturalPick } from "@/types/pick";
import type { PickType } from "./model";
export const BOOK_FIELDS =
  "key,title,author_name,first_publish_year,subject,cover_i,language,editions,editions.key,editions.title,editions.language,editions.cover_i";
const movieGenres: Record<string, number> = {
  art: 18,
  ideas: 99,
  history: 36,
  psychology: 18,
  science: 878,
  technology: 878,
  travel: 12,
  food: 99,
  photography: 99,
  design: 99,
  nature: 99,
  music: 10402,
  film: 18,
  architecture: 99,
  creativity: 18,
  books: 18,
};
export const getTmdbPick = unstable_cache(
  async (type: "film" | "tv", id: number) =>
    normalizeTmdb(
      await providerJson<Record<string, unknown>>(
        `https://api.themoviedb.org/3/${type === "film" ? "movie" : "tv"}/${id}?append_to_response=credits&language=en-US`,
      ),
      type,
    ),
  ["pick-tmdb-object-v2"],
  { revalidate: CACHE_SECONDS.tmdb },
);
export const getBookPick = unstable_cache(
  async (id: string) => {
    if (!/^OL[1-9][0-9]*W$/.test(id)) return null;
    const body = await providerJson<{ docs: Record<string, unknown>[] }>(
      `https://openlibrary.org/search.json?${new URLSearchParams({ q: `key:/works/${id} AND language:eng`, fields: BOOK_FIELDS, lang: "en", limit: "1" })}`,
    );
    return normalizeBook(body.docs?.[0] ?? {});
  },
  ["pick-book-object-v2"],
  { revalidate: CACHE_SECONDS.openlibrary },
);
export const getAlbumPick = unstable_cache(
  async (id: string) =>
    normalizeAlbum(
      await providerJson<Record<string, unknown>>(
        `https://musicbrainz.org/ws/2/release-group/${id}?inc=artist-credits&fmt=json`,
      ),
    ),
  ["pick-album-object-v2"],
  { revalidate: CACHE_SECONDS.musicbrainz },
);
const getBookSubjectPool = unstable_cache(
  async (subject: string) => {
    const result = await providerJson<{ docs: Record<string, unknown>[] }>(
      `https://openlibrary.org/search.json?${new URLSearchParams({ subject, q: "language:eng", fields: BOOK_FIELDS, limit: "30", sort: "random.daily", lang: "en" })}`,
    );
    return (result.docs ?? []).flatMap((raw) => {
      const item = normalizeBook(raw);
      return item ? [item] : [];
    });
  },
  ["pick-book-subject-v1"],
  { revalidate: CACHE_SECONDS.openlibrary },
);
export const getPickPool = unstable_cache(
  async (type: PickType, interests: string[]): Promise<CulturalPick[]> => {
    if (type === "book") return loadBookPool(interests, getBookSubjectPool);
    if (type === "album") {
      const result = await providerJson<{
        "release-groups": Record<string, unknown>[];
      }>(
        `https://musicbrainz.org/ws/2/release-group/?${new URLSearchParams({ query: "primarytype:album AND NOT secondarytype:compilation AND (tag:jazz OR tag:ambient OR tag:experimental OR tag:world)", fmt: "json", limit: "30" })}`,
      );
      const pool = (result["release-groups"] ?? []).flatMap((raw) => {
        const item = normalizeAlbum(raw, "search");
        return item
          ? [
              {
                ...item,
                interestIds: interests.filter((i) =>
                  ["music", "art", "ideas", "creativity"].includes(i),
                ),
              },
            ]
          : [];
      });
      pickDiagnostic("album", {
        outcome: pool.length ? "success" : "empty",
        candidates: pool.length,
      });
      return pool;
    }
    if (!process.env.TMDB_READ_ACCESS_TOKEN) {
      pickDiagnostic(type, {
        outcome: "unavailable",
        reason: "missing credentials",
      });
      return [];
    }
    const genre =
      seededOrder(interests, "film-genre", (i) => i)
        .map((i) => movieGenres[i])
        .find(Boolean) ?? 18;
    const ranges = [
      ["1950-01-01", "1999-12-31"],
      ["2000-01-01", new Date().toISOString().slice(0, 10)],
    ];
    const pool: CulturalPick[] = [];
    for (const [from, to] of ranges) {
      const p = new URLSearchParams({
        include_adult: "false",
        language: "en-US",
        with_genres: String(
          type === "tv" ? (genre === 878 ? 10765 : 18) : genre,
        ),
        sort_by:
          type === "film" ? "primary_release_date.asc" : "first_air_date.asc",
        "vote_count.gte": "20",
        page: "1",
      });
      p.set(
        type === "film" ? "primary_release_date.gte" : "first_air_date.gte",
        from,
      );
      p.set(
        type === "film" ? "primary_release_date.lte" : "first_air_date.lte",
        to,
      );
      const result = await providerJson<{ results: Record<string, unknown>[] }>(
        `https://api.themoviedb.org/3/discover/${type === "film" ? "movie" : "tv"}?${p}`,
      );
      for (const raw of result.results ?? []) {
        const item = normalizeTmdb(raw, type);
        if (item)
          pool.push({
            ...item,
            interestIds: interests.filter((i) => movieGenres[i] === genre),
          });
      }
    }
    return pool;
  },
  ["pick-provider-pool-v4"],
  { revalidate: 86400 },
);
export async function getPickById(type: PickType, id: string) {
  if (type === "film" || type === "tv") {
    const item = /^[1-9][0-9]{0,9}$/.test(id)
      ? await getTmdbPick(type, Number(id))
      : null;
    return item && validPick(item) ? item : null;
  }
  if (type === "book") return getBookPick(id);
  return /^[0-9a-f-]{36}$/.test(id) ? getAlbumPick(id) : null;
}
