/** Compare the browser Origin with the incoming Host, not Next's internal bind URL. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host.toLowerCase() ===
        (request.headers.get("host") ?? new URL(request.url).host).toLowerCase()
    );
  } catch {
    return false;
  }
}
export function publicRequestUrl(request: Request) {
  const url = new URL(request.url);
  url.host = request.headers.get("host") ?? url.host;
  return url;
}
