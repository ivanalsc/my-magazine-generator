import { PickHttpError } from "./diagnostics";
import { supabaseConfig } from "@/lib/supabase/config";
const allowed = new Set([
  "api.themoviedb.org",
  "openlibrary.org",
  "musicbrainz.org",
]);
export const CACHE_SECONDS = {
  tmdb: 86400,
  openlibrary: 86400,
  musicbrainz: 86400,
};
export function contactAgent() {
  const contact = process.env.CULTURAL_API_CONTACT?.trim();
  if (!contact || /[\r\n]/.test(contact))
    throw new Error("Cultural API contact is not configured");
  return `MyMagazineGenerator/1.0 (${contact})`;
}
export function createRequestQueue(
  interval = 1100,
  now = () => Date.now(),
  pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
) {
  let tail: Promise<unknown> = Promise.resolve(),
    last = -Infinity;
  return <T>(work: () => Promise<T>) => {
    const result = tail.then(async () => {
      await pause(Math.max(0, last + interval - now()));
      last = now();
      return work();
    });
    tail = result.catch(() => undefined);
    return result;
  };
}
const globalQueue = globalThis as typeof globalThis & {
  pickQueues?: Record<string, ReturnType<typeof createRequestQueue>>;
};
const queues = globalQueue.pickQueues ?? (globalQueue.pickQueues = {});
async function reserveMusicbrainz() {
  const config = supabaseConfig();
  if (!config)
    throw new Error("MusicBrainz requires the shared request limiter");
  const response = await fetch(
    `${config.url}/rest/v1/rpc/reserve_musicbrainz_request`,
    {
      method: "POST",
      headers: { apikey: config.key, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok)
    throw new Error("MusicBrainz request limiter is unavailable");
  const delay = await response.json();
  if (!Number.isInteger(delay) || delay < 0 || delay > 5000)
    throw new Error("MusicBrainz queue is full");
  if (delay) await new Promise((r) => setTimeout(r, delay));
}
export async function providerJson<T>(url: string): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !allowed.has(parsed.hostname))
    throw new Error("Unsupported pick provider");
  const host = parsed.hostname;
  const work = async () => {
    if (host === "musicbrainz.org") await reserveMusicbrainz();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": contactAgent(),
    };
    if (host === "api.themoviedb.org") {
      const token = process.env.TMDB_READ_ACCESS_TOKEN;
      if (!token) throw new Error("TMDB is not configured");
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new PickHttpError(response.status);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty provider response");
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 2000000) {
        await reader.cancel();
        throw new Error("Provider response exceeds limit");
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  };
  return (queues[host] ?? (queues[host] = createRequestQueue()))(work);
}
