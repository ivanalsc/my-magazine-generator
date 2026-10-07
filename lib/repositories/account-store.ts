"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { AccountData, AccountState } from "./models";
import { repositoryRequest } from "./http";
import { supabaseConfig } from "@/lib/supabase/config";
type State = AccountState;
export const AccountStateContext = createContext<State | undefined>(undefined);
let state: State | undefined;
let revision = 0;
let mutationQueue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
function publish(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}
export function useAccountState() {
  const initial = useContext(AccountStateContext);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state ?? initial,
    () => initial,
  );
}
export async function refreshAccount() {
  const started = ++revision;
  if (!supabaseConfig()) {
    publish({ mode: "guest" });
    return;
  }
  try {
    const result = await repositoryRequest<AccountData | null>("/api/account");
    if (started !== revision) return;
    publish(
      result
        ? {
            mode: "account",
            data: result,
            identity: { userId: result.userId, email: result.email },
          }
        : { mode: "guest" },
    );
  } catch (error) {
    if (started !== revision) return;
    publish({
      mode: "error",
      identity: state?.identity,
      error:
        error instanceof Error ? error.message : "Your account is unavailable.",
    });
  }
}
async function mutateAccount(
  operation: string,
  payload?: unknown,
): Promise<string | null> {
  if (state?.mode === "guest") return "Guest";
  if (state?.mode !== "account")
    return "Your account is unavailable. Retry before changing your library.";
  const owner = state?.data!.userId;
  ++revision;
  try {
    const data = await repositoryRequest<AccountData>("/api/account", "POST", {
      operation,
      payload,
    });
    if (
      state?.mode !== "account" ||
      state?.data?.userId !== owner ||
      data.userId !== owner
    )
      return "Your session changed. Reopen your library before saving.";
    ++revision;
    publish({
      mode: "account",
      data,
      identity: { userId: data.userId, email: data.email },
    });
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Your changes could not be saved.";
  }
}
export function persistenceMode() {
  return state?.mode;
}

export function accountMutation(
  operation: string,
  payload?: unknown,
): Promise<string | null> {
  const owner = state?.data?.userId;
  const result = mutationQueue.then(() =>
    state?.data?.userId === owner
      ? mutateAccount(operation, payload)
      : "Your session changed. Reopen your library before saving.",
  );
  mutationQueue = result.catch(() => undefined);
  return result;
}

export function accountSavedHasKey(key: string) {
  return (
    state?.mode === "account" &&
    state?.data!.saved.some((entry) => entry.key === key)
  );
}

export function hydrateAccount(initial: State) {
  const owner = state?.identity?.userId ?? state?.data?.userId;
  if (
    !state ||
    owner !== initial.identity?.userId ||
    initial.mode === "guest"
  ) {
    ++revision;
    publish(initial);
  }
}
export function clearAccountSession() {
  ++revision;
  publish({ mode: "guest" });
}
