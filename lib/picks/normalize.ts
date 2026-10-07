import type { FilmPick, TvPick, BookPick, AlbumPick } from "@/types/pick";
import { pickBase, validPick } from "./model";
import { meaningfulText, readableDisplay, discoveryTitle } from "./quality";
function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object",
      )
    : [];
}
export function normalizeTmdb(
  raw: Record<string, unknown>,
  type: "film" | "tv",
): FilmPick | TvPick | null {
  const id = Number(raw.id),
    title = type === "film" ? raw.title : raw.name;
  if (
    raw.adult === true ||
    !Number.isInteger(id) ||
    id <= 0 ||
    !discoveryTitle(title) ||
    !readableDisplay(title)
  )
    return null;
  const date = type === "film" ? raw.release_date : raw.first_air_date;
  const credits =
    raw.credits && typeof raw.credits === "object"
      ? (raw.credits as Record<string, unknown>)
      : {};
  const creators =
    type === "film"
      ? records(credits.crew)
          .filter((c) => c.job === "Director")
          .flatMap((c) => (meaningfulText(c.name) ? [c.name.trim()] : []))
      : records(raw.created_by).flatMap((c) =>
          meaningfulText(c.name) ? [c.name.trim()] : [],
        );
  const item = {
    ...pickBase(
      "tmdb",
      type,
      id,
      title,
      [...new Set(creators)],
      typeof date === "string" && /^\d{4}-/.test(date)
        ? date.slice(0, 4)
        : undefined,
    ),
    mediaType: type,
    providerId: id,
    topics: records(raw.genres).flatMap((g) =>
      meaningfulText(g.name) ? [g.name.trim()] : [],
    ),
  };
  const poster = raw.poster_path;
  if (typeof poster === "string" && /^\/[A-Za-z0-9._-]+$/.test(poster))
    Object.assign(item, {
      image: {
        src: `https://image.tmdb.org/t/p/w500${poster}`,
        alt: `${title} poster`,
        credit: "TMDB",
        creditUrl: item.originalUrl,
        license: "TMDB API terms; not public domain",
      },
    });
  return validPick(item) ? item : null;
}
export function normalizeBook(raw: Record<string, unknown>): BookPick | null {
  const work =
    typeof raw.key === "string" ? raw.key.replace(/^\/works\//, "") : "";
  if (
    !/^OL[1-9][0-9]*W$/.test(work) ||
    typeof raw.title !== "string" ||
    !raw.title.trim()
  )
    return null;
  const editions = raw.editions as
    | { docs?: Record<string, unknown>[] }
    | undefined;
  const englishEdition = Array.isArray(editions?.docs)
    ? records(editions.docs).find(
        (edition) =>
          Array.isArray(edition.language) &&
          edition.language.includes("eng") &&
          discoveryTitle(edition.title) &&
          readableDisplay(edition.title),
      )
    : undefined;
  // A multilingual work title is not necessarily its English display title.
  // Prefer provider-labelled English edition metadata; accept work-level title
  // only when its explicitly declared language is English alone.
  const englishWork =
    Array.isArray(raw.language) &&
    raw.language.length === 1 &&
    raw.language[0] === "eng";
  const title = englishEdition?.title ?? (englishWork ? raw.title : undefined);
  if (!discoveryTitle(title) || !readableDisplay(title)) return null;
  const creators = Array.isArray(raw.author_name)
    ? raw.author_name.filter(meaningfulText).map((a) => a.trim())
    : [];
  if (creators.length === 0) return null;
  const item = {
    ...pickBase(
      "openlibrary",
      "book",
      work,
      title,
      [...new Set(creators)],
      Number.isInteger(raw.first_publish_year)
        ? String(raw.first_publish_year)
        : undefined,
    ),
    mediaType: "book" as const,
    providerId: work,
    topics: Array.isArray(raw.subject)
      ? raw.subject
          .filter((s): s is string => typeof s === "string")
          .slice(0, 6)
      : [],
  };
  const cover = Number(englishEdition?.cover_i ?? raw.cover_i);
  if (Number.isInteger(cover) && cover > 0)
    Object.assign(item, {
      coverId: cover,
      image: {
        src: `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false`,
        alt: `${title} book cover`,
        credit: "Open Library Covers API",
        creditUrl: item.originalUrl,
        license: "Cover rights belong to their respective owners",
      },
    });
  return validPick(item) ? item : null;
}
export function normalizeAlbum(
  raw: Record<string, unknown>,
  shape: "search" | "detail" = "detail",
): AlbumPick | null {
  // Search omits secondary-types for an Album with no secondary classification.
  // Detail payloads still require the explicit array; present malformed fields
  // are never treated as absence.
  const secondary =
    shape === "search" &&
    raw["primary-type"] === "Album" &&
    !Object.hasOwn(raw, "secondary-types")
      ? []
      : raw["secondary-types"];
  if (
    raw["primary-type"] !== "Album" ||
    !Array.isArray(secondary) ||
    !secondary.every((t) => typeof t === "string") ||
    secondary.some((t) =>
      [
        "Compilation",
        "Interview",
        "DJ-mix",
        "Mixtape/Street",
        "Broadcast",
      ].includes(String(t)),
    ) ||
    typeof raw.id !== "string" ||
    typeof raw.title !== "string"
  )
    return null;
  const creators = records(raw["artist-credit"]).flatMap((c) => {
    const artist =
      c.artist && typeof c.artist === "object"
        ? (c.artist as Record<string, unknown>)
        : {};
    const name = c.name ?? artist.name;
    return meaningfulText(name) ? [name.trim()] : [];
  });
  if (
    !discoveryTitle(raw.title) ||
    !readableDisplay(raw.title) ||
    creators.length === 0 ||
    !creators.every(meaningfulText)
  )
    return null;
  const date = raw["first-release-date"];
  const item = {
    ...pickBase(
      "musicbrainz",
      "album",
      raw.id,
      raw.title,
      creators,
      typeof date === "string" && /^\d{4}/.test(date)
        ? date.slice(0, 4)
        : undefined,
    ),
    mediaType: "album" as const,
    providerId: raw.id,
    primaryType: "Album" as const,
  };
  return validPick(item) ? item : null;
}
