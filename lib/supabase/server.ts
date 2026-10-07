import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function createSupabaseServerClient() {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components are read-only; proxy refreshes cookies. */
        }
      },
    },
  });
}
export async function accountSession() {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  const { data, error } = await client.auth.getClaims();
  if (error && error.name !== "AuthSessionMissingError")
    throw new Error(
      "Your session could not be verified. Please sign in again.",
    );
  const userId = data?.claims?.sub;
  return userId
    ? {
        client,
        userId,
        email:
          typeof data?.claims?.email === "string"
            ? data.claims.email
            : undefined,
      }
    : null;
}
