"use client";
import { prepareStoryForDisplay } from "@/lib/content/prepare";
import {
  useAccountState,
  accountMutation,
  persistenceMode,
  accountSavedHasKey,
} from "@/lib/repositories/account-store";
import type { EditorialStory, CulturalItem } from "@/types/editorial";
import { savedKey } from "./saved-parser";
export { savedKey, parseSaved } from "./saved-parser";
export const SAVED_KEY = "my-magazine-generator:saved:v1"; // Legacy key, cleanup only. Never read as a library.
export function useSaved() {
  const account = useAccountState();
  return {
    ready: !!account && ["guest", "account"].includes(account.mode),
    items: account?.mode === "account" ? account.data!.saved : [],
  };
}
export async function toggleSaved(
  item: EditorialStory | CulturalItem,
): Promise<string | null> {
  if (persistenceMode() === "guest")
    return "Sign in to keep this discovery in your personal collection.";
  if (item.contentPolicy === "external") item = prepareStoryForDisplay(item);
  return accountMutation("saved", {
    item,
    keep: !accountSavedHasKey(savedKey(item)),
  });
}
