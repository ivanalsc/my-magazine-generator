const hosts = new Set([
  "en.wikipedia.org",
  "commons.wikimedia.org",
  "collectionapi.metmuseum.org",
]);
export async function openApiJson<T>(url: string): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !hosts.has(parsed.hostname))
    throw new Error("Unsupported cultural API.");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: {
      "User-Agent":
        "MyMagazineGenerator/1.0 (cultural discovery; local portfolio prototype)",
      Accept: "application/json",
    },
  });
  if (!response.ok)
    throw new Error(`Cultural API returned ${response.status}.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty API response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 3 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Cultural API response too large.");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
