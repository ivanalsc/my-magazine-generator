"use client";
import {
  safeAuthDiagnostic,
  emailRequestError,
} from "@/lib/account/presentation";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
export function browserAuth() {
  const config = supabaseConfig();
  if (!config)
    throw new Error(
      "Account sync is not configured yet. You can keep exploring as a guest.",
    );
  return createBrowserClient(config.url, config.key);
}
export async function sendMagicLink(email: string) {
  try {
    const { error } = await browserAuth().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(new URLSearchParams(location.search).get("next") ?? "/account")}`,
        shouldCreateUser: true,
      },
    });
    if (error) throw error;
  } catch (error) {
    if (process.env.NODE_ENV === "development")
      console.warn(
        "[auth] Email link request failed",
        safeAuthDiagnostic(error),
      );
    throw new Error(emailRequestError(error));
  }
}
