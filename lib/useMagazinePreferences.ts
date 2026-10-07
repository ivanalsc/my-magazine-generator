"use client";
import {
  useAccountState,
  accountMutation,
  persistenceMode,
} from "./repositories/account-store";
import { useMemo, useSyncExternalStore } from "react";
import type { UserMagazinePreferences } from "@/types/editorial";
import { parsePreferences, PREFERENCES_KEY } from "./preferences";
const CHANGE_EVENT = "magazine-preferences-changed";
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === PREFERENCES_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
function snapshot(): string | null {
  try {
    return window.localStorage.getItem(PREFERENCES_KEY);
  } catch {
    return null;
  }
}
function serverSnapshot(): undefined {
  return undefined;
}
export async function savePreferences(
  preferences: UserMagazinePreferences,
): Promise<string | null> {
  const sanitized = parsePreferences(JSON.stringify(preferences));
  if (!sanitized)
    return "Choose at least three interests to make your magazine.";
  if (persistenceMode() !== "guest")
    return accountMutation("preferences", sanitized);
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return null;
  } catch {
    return "Your browser could not save your choices. Allow local storage for this site and try again.";
  }
}
export async function clearPreferences(): Promise<string | null> {
  if (persistenceMode() !== "guest")
    return accountMutation("preferences", null);
  try {
    window.localStorage.removeItem(PREFERENCES_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return null;
  } catch {
    return "Your browser could not reset your choices. Allow local storage for this site and try again.";
  }
}
export function useMagazinePreferences() {
  const account = useAccountState();
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const preferences = useMemo(() => parsePreferences(raw), [raw]);
  return {
    preferences:
      account?.mode === "account" ? account.data!.preferences : preferences,
    ready:
      raw !== undefined &&
      !!account &&
      ["guest", "account"].includes(account.mode),
  };
}
