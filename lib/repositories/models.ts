import type { MagazineIssue, UserMagazinePreferences } from "@/types/editorial";
import type { SavedItem } from "@/types/saved";
export interface IssueEnvelope {
  issue: MagazineIssue;
  preferences: UserMagazinePreferences;
  fallback: boolean;
  partial: boolean;
  loadedCount: number;
  createdAt?: string;
  revision?: number;
  recentSelections?: string[];
  refreshAvailable?: boolean;
}
export interface IssueSummary {
  id: string;
  number: string;
  date: string;
  createdAt: string;
  preferences: UserMagazinePreferences;
  pieces: number;
  title?: string;
}
export interface AccountData {
  userId: string;
  email?: string;
  preferences: UserMagazinePreferences | null;
  saved: SavedItem[];
}
export function mergePreferences(
  account: UserMagazinePreferences | null,
  guest: UserMagazinePreferences | null,
): UserMagazinePreferences | null {
  if (!account) return guest;
  if (!guest) return account;
  const customs = new Map(
    account.customSources.map((source) => [
      source.feedUrl ?? source.websiteUrl,
      source,
    ]),
  );
  guest.customSources.forEach((source) => {
    const key = source.feedUrl ?? source.websiteUrl;
    if (!customs.has(key)) customs.set(key, source);
  });
  if (customs.size > 8)
    throw new Error(
      "The combined library has more than eight custom feeds. Edit your guest sources before merging.",
    );
  return {
    version: 1,
    interests: [...new Set([...account.interests, ...guest.interests])],
    sources: [...new Set([...account.sources, ...guest.sources])],
    customSources: [...customs.values()],
  };
}
export function mergeSaved(
  account: SavedItem[],
  guest: SavedItem[],
): SavedItem[] {
  const entries = new Map(account.map((item) => [item.key, item]));
  guest.forEach((item) => {
    if (!entries.has(item.key)) entries.set(item.key, item);
  });
  return [...entries.values()];
}

export interface AccountIdentity {
  userId: string;
  email?: string;
}
export interface AccountState {
  mode: "loading" | "guest" | "account" | "error";
  identity?: AccountIdentity;
  data?: AccountData;
  error?: string;
}
