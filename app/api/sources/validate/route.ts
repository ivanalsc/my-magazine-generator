import { unstable_cache } from "next/cache";
import { validateCustomFeed } from "@/lib/sources/rss";
import { FeedError, safeUrl } from "@/lib/sources/safety";
import { readSmallJson } from "@/lib/sources/request";
export const runtime = "nodejs";
const validateCachedFeed = unstable_cache(
  validateCustomFeed,
  ["custom-feed-validation-v1"],
  { revalidate: 1800 },
);
export async function POST(request: Request) {
  try {
    const input = (await readSmallJson(request)) as { url?: unknown };
    if (typeof input?.url !== "string" || input.url.length > 2000)
      throw new FeedError("Enter a public RSS/Atom or Substack URL.");
    const source = await validateCachedFeed(safeUrl(input.url).href);
    return Response.json({ state: "valid", source });
  } catch (error) {
    const network = error instanceof FeedError && error.kind === "network";
    return Response.json(
      {
        state: network ? "network-error" : "invalid",
        error:
          error instanceof FeedError
            ? error.message
            : "We couldn’t find a readable feed for this publication.",
      },
      { status: network ? 502 : 400 },
    );
  }
}
