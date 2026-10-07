import "server-only";
import { accountSession } from "@/lib/supabase/server";
import type { AccountState } from "@/lib/repositories/models";
export async function initialAccountState(): Promise<AccountState> {
  try {
    const session = await accountSession();
    return session
      ? {
          mode: "loading",
          identity: { userId: session.userId, email: session.email },
        }
      : { mode: "guest" };
  } catch (error) {
    if (process.env.NODE_ENV === "development")
      console.error(
        "[auth] Session verification failed",
        error instanceof Error ? error.name : "Unknown error",
      );
    return {
      mode: "error",
      error: "Your library couldn’t be reached. Reconnect to continue.",
    };
  }
}
