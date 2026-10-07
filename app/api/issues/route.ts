import { accountSession } from "@/lib/supabase/server";
import { SupabaseLibraryRepository } from "@/lib/repositories/supabase";
export async function GET() {
  try {
    const session = await accountSession();
    if (!session)
      return Response.json(
        { error: "Sign in to open your archive." },
        { status: 401 },
      );
    return Response.json(
      await new SupabaseLibraryRepository(
        session.client,
        session.userId,
      ).listIssues(),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Your archive is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
