"use client";
import { useEffect } from "react";
import { supabaseConfig } from "@/lib/supabase/config";
import { browserAuth } from "@/lib/supabase/browser";
import {
  AccountStateContext,
  hydrateAccount,
  useAccountState,
  refreshAccount,
} from "@/lib/repositories/account-store";
import type { AccountState } from "@/lib/repositories/models";
export function AccountProvider({
  initialState,
  children,
}: {
  initialState: AccountState;
  children: React.ReactNode;
}) {
  useEffect(() => {
    try {
      localStorage.removeItem("my-magazine-generator:saved:v1");
    } catch {}
    hydrateAccount(initialState);
    if (initialState.mode === "loading") void refreshAccount();
  }, [initialState]);
  useEffect(() => {
    if (!supabaseConfig()) return;
    const { data } = browserAuth().auth.onAuthStateChange((event) => {
      if (["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"].includes(event))
        queueMicrotask(() => void refreshAccount());
    });
    const reconnect = () => {
      if (document.visibilityState === "visible") void refreshAccount();
    };
    document.addEventListener("visibilitychange", reconnect);
    return () => {
      data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", reconnect);
    };
  }, []);
  return (
    <AccountStateContext.Provider value={initialState}>
      <AccountNotice />
      {children}
    </AccountStateContext.Provider>
  );
}
function AccountNotice() {
  const account = useAccountState();
  return account?.mode === "error" ? (
    <div className="library-notice" role="alert">
      <p>{account.error}</p>
      <button className="quiet-button" onClick={() => void refreshAccount()}>
        Reconnect →
      </button>
    </div>
  ) : null;
}
