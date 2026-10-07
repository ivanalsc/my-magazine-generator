export function seedNumber(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function seededOrder<T>(
  items: T[],
  seed: string,
  identity: (item: T) => string,
): T[] {
  return [...items].sort(
    (a, b) =>
      seedNumber(`${seed}:${identity(a)}`) -
        seedNumber(`${seed}:${identity(b)}`) ||
      identity(a).localeCompare(identity(b)),
  );
}

export interface DiscoverySelection {
  recent?: string[];
  exclude?: string[];
  counter?: number;
  excludeImages?: string[];
}

export function discoveryOrder<T>(
  items: T[],
  seed: string,
  identity: (item: T) => string,
  selection: DiscoverySelection = {},
  quality: (item: T) => number = () => 0,
): T[] {
  const blocked = new Set(selection.exclude ?? []),
    recent = new Set(selection.recent ?? []);
  return seededOrder(
    items.filter((item) => !blocked.has(identity(item))),
    `${seed}:${selection.counter ?? 0}`,
    identity,
  ).sort(
    (a, b) =>
      Number(recent.has(identity(a))) - Number(recent.has(identity(b))) ||
      quality(b) - quality(a),
  );
}
export function discoveryAttempts<T>(
  ordered: T[],
  identity: (item: T) => string,
  recent: string[],
  limit: number,
): T[] {
  const seen = new Set(recent);
  // Prefer bounded new candidates, then try known repeats only if those fail validation.
  return [
    ...ordered.filter((item) => !seen.has(identity(item))).slice(0, limit),
    ...ordered.filter((item) => seen.has(identity(item))).slice(0, limit),
  ];
}
