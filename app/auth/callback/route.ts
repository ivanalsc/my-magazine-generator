import { safeAuthDiagnostic } from "@/lib/account/presentation";
import { publicRequestUrl } from "@/lib/http/origin";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
function redirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function GET(request: Request) {
  const url = publicRequestUrl(request);
  const client = await createSupabaseServerClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  try {
    if (client) {
      const result = code
        ? await client.auth.exchangeCodeForSession(code)
        : tokenHash
          ? await client.auth.verifyOtp({
              token_hash: tokenHash,
              type: "email",
            })
          : null;
      if (result?.error && process.env.NODE_ENV === "development")
        console.warn(
          "[auth] Callback rejected",
          safeAuthDiagnostic(result.error),
        );
      if (result && !result.error)
        return redirect(
          new URL(
            (() => {
              const next = url.searchParams.get("next");
              return next === "/" ||
                /^\/explore\/(film|tv|book|album|artwork|wikipedia)\/[A-Za-z0-9-]+$/.test(
                  next ?? "",
                )
                ? next!
                : "/account";
            })(),
            url.origin,
          ),
        );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[auth] Callback failed", safeAuthDiagnostic(error));
  }
  return redirect(new URL("/sign-in?error=callback", url.origin));
}
