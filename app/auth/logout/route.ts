import { sameOrigin } from "@/lib/http/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const client = await createSupabaseServerClient();
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "We couldn’t sign you out. Please try again." },
      { status: 503 },
    );
  }
}
