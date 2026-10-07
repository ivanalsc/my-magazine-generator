import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";

export class FeedError extends Error {
  constructor(
    message: string,
    public kind: "invalid" | "network" = "invalid",
  ) {
    super(message);
  }
}
export function isPublicIp(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  // IANA special registry reserves 192.0.0.0/24, not 192.0.0.0/16.
  // Keep the entire /24 blocked; 192.0.66.x is public publisher infrastructure.
  if (isIP(ip) === 4) {
    const [a, b, c] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 &&
        (b === 168 ||
          (b === 0 && (c === 0 || c === 2)) ||
          (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  // Allow only global unicast IPv6; mapped IPv4, ULA, link-local and transition ranges fail closed.
  if (isIP(ip) === 6) {
    if (ip.includes(".")) return false;
    const halves = ip.split("::");
    const left = halves[0] ? halves[0].split(":") : [];
    const right = halves[1] ? halves[1].split(":") : [];
    const words =
      halves.length === 2
        ? [
            ...left,
            ...Array(8 - left.length - right.length).fill("0"),
            ...right,
          ]
        : left;
    const [first, second] = words.map((word) => parseInt(word, 16));
    return (
      first >= 0x2000 &&
      first <= 0x3fff &&
      first !== 0x2002 &&
      first !== 0x3fff &&
      !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8))
    );
  }
  return false;
}
export function safeUrl(input: string): URL {
  if (input.length > 2000) throw new FeedError("The feed URL is too long.");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FeedError(
      "Enter a complete public http:// or https:// feed URL.",
    );
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    !host ||
    /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/.test(host) ||
    host === "metadata.google.internal" ||
    (isIP(host) ? !isPublicIp(host) : !host.includes("."))
  ) {
    throw new FeedError(
      "Use a public HTTP or HTTPS feed. Local and private addresses aren’t allowed.",
    );
  }
  url.hash = "";
  return url;
}
export function publicLink(input: unknown, base?: string): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  try {
    return safeUrl(new URL(input, base).href).href;
  } catch {
    return undefined;
  }
}
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT = 12_000;
export function assertPublicAddresses(
  addresses: { address: string; family: number }[],
) {
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicIp(address))
  )
    throw new FeedError("The feed resolves to a private or reserved network.");
}
export async function fetchFeedXml(
  input: string,
  deadline = Date.now() + TIMEOUT,
  hops = 0,
): Promise<{ xml: string; url: string }> {
  if (hops > 3 || Date.now() >= deadline)
    throw new FeedError("The feed took too long to respond.", "network");
  const url = safeUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  try {
    addresses = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new FeedError("DNS lookup timed out.", "network")),
          Math.max(1, deadline - Date.now()),
        );
        timer.unref();
      }),
    ]);
  } catch (error) {
    if (error instanceof FeedError) throw error;
    throw new FeedError(
      "We couldn’t reach this publication. Try again later.",
      "network",
    );
  }
  assertPublicAddresses(addresses);
  // Pin the validated DNS address on the actual socket to prevent DNS rebinding.
  const address = addresses[0];
  const response = await new Promise<{ xml?: string; redirect?: string }>(
    (resolve, reject) => {
      const request = (url.protocol === "https:" ? https : http).get(
        url,
        {
          headers: {
            "User-Agent": "MyMagazineGenerator/1.0 (RSS reader)",
            Accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml",
            "Accept-Encoding": "identity",
          },
          lookup: (_hostname, options, callback) => {
            if (typeof options === "object" && options.all)
              callback(null, [address]);
            else callback(null, address.address, address.family);
          },
        },
        (res) => {
          res.once("error", reject);
          if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
            res.destroy();
            if (!res.headers.location)
              reject(new FeedError("The feed redirect is incomplete."));
            else {
              try {
                resolve({ redirect: new URL(res.headers.location, url).href });
              } catch {
                reject(new FeedError("The feed redirect is invalid."));
              }
            }
            return;
          }
          if (res.statusCode !== 200) {
            res.destroy();
            reject(
              new FeedError(
                `Publication returned HTTP ${res.statusCode}.`,
                "network",
              ),
            );
            return;
          }
          if (
            Number(res.headers["content-length"]) > MAX_BYTES ||
            (res.headers["content-encoding"] &&
              res.headers["content-encoding"] !== "identity")
          ) {
            res.destroy();
            reject(
              new FeedError(
                "The feed is too large or uses an unsupported encoding.",
              ),
            );
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_BYTES) {
              request.destroy(
                new FeedError("The feed exceeds the 2 MB limit."),
              );
            } else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({ xml: Buffer.concat(chunks).toString("utf8") }),
          );
        },
      );
      const timer = setTimeout(
        () =>
          request.destroy(
            new FeedError("The publication timed out.", "network"),
          ),
        Math.max(1, deadline - Date.now()),
      );
      request.on("close", () => clearTimeout(timer));
      request.on("error", (error) =>
        reject(
          error instanceof FeedError
            ? error
            : new FeedError(
                "We couldn’t reach this publication. Try again later.",
                "network",
              ),
        ),
      );
    },
  );
  if (response.redirect)
    return fetchFeedXml(response.redirect, deadline, hops + 1);
  const xml = response.xml!;
  if (
    !/<(?:rss|feed|rdf:RDF)\b/i.test(xml.slice(0, 4096)) ||
    /<!DOCTYPE|<!ENTITY/i.test(xml)
  )
    throw new FeedError(
      "We couldn’t find a readable RSS or Atom feed at this URL.",
    );
  return { xml, url: url.href };
}
