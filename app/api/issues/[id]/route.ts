import { accountSession } from "@/lib/supabase/server";
import { SupabaseLibraryRepository } from "@/lib/repositories/supabase";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await accountSession();
    if (!session)
      return Response.json(
        { error: "Sign in to open this issue." },
        { status: 401 },
      );
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      return Response.json({ error: "Issue not found." }, { status: 404 });
    const result = await new SupabaseLibraryRepository(
      session.client,
      session.userId,
    ).issue(id);
    return result
      ? Response.json(result, {
          headers: { "Cache-Control": "private, no-store" },
        })
      : Response.json(
          { error: "Issue not found in your library." },
          { status: 404 },
        );
  } catch {
    return Response.json(
      { error: "This issue is unavailable. Please try again." },
      { status: 503 },
    );
  }
}
