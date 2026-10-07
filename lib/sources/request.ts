import { FeedError } from "./safety";
export async function readSmallJson(
  request: Request,
  maxBytes = 24_000,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new FeedError("Missing request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new FeedError("Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new FeedError("Invalid request.");
  }
}
