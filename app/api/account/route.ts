import { sameOrigin } from "@/lib/http/origin";
import { verifySavedEntry } from "@/lib/repositories/verified-saved";
import { accountSession } from "@/lib/supabase/server";
import {
  SupabaseLibraryRepository,
  makeSavedEntry,
} from "@/lib/repositories/supabase";
import { parsePreferences } from "@/lib/preferences";
import { readSmallJson } from "@/lib/sources/request";
import type { EditorialStory, CulturalItem } from "@/types/editorial";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const session = await accountSession();
    return Response.json(
      session
        ? await new SupabaseLibraryRepository(
            session.client,
            session.userId,
            session.email,
          ).account()
        : null,
      { headers },
    );
  } catch {
    return Response.json(
      {
        error:
          "Your account library is unavailable. Retry to reconnect; local guest data is safe.",
      },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "This request must come from your magazine." },
      { status: 403 },
    );
  try {
    const session = await accountSession();
    if (!session)
      return Response.json(
        { error: "Sign in to update your account." },
        { status: 401 },
      );
    const { operation, payload } = (await readSmallJson(
      request,
      2_000_000,
    )) as { operation: string; payload: unknown };
    const repository = new SupabaseLibraryRepository(
      session.client,
      session.userId,
      session.email,
    );
    if (operation === "preferences") {
      const preferences =
        payload === null ? null : parsePreferences(JSON.stringify(payload));
      if (payload !== null && !preferences)
        return Response.json(
          { error: "Choose at least three valid interests." },
          { status: 400 },
        );
      await repository.setPreferences(preferences);
    } else if (operation === "saved") {
      const { item, keep } = payload as {
        item: EditorialStory | CulturalItem;
        keep: boolean;
      };
      const entry = makeSavedEntry(item);
      if (!entry || typeof keep !== "boolean")
        return Response.json(
          { error: "This discovery could not be saved." },
          { status: 400 },
        );
      await repository.setSaved(
        keep ? await verifySavedEntry(entry) : entry,
        keep,
      );
    } else
      return Response.json(
        { error: "Unknown library operation." },
        { status: 400 },
      );
    return Response.json(await repository.account(), { headers });
  } catch {
    return Response.json(
      {
        error:
          "We couldn’t confirm your account changes. Reconnect and try again. Guest data is still on this device.",
      },
      { status: 503, headers },
    );
  }
}
