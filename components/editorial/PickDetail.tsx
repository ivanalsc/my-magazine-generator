import Link from "next/link";
import { notFound } from "next/navigation";
import { getPickById } from "@/lib/picks/providers";
import { MagazineHeader } from "./Magazine";
import { CulturalPickFeature } from "./CulturalPickFeature";
import type { PickType } from "@/lib/picks/model";
export async function PickDetail({ type, id }: { type: PickType; id: string }) {
  if (
    !(type === "film" || type === "tv"
      ? /^[1-9][0-9]{0,9}$/.test(id)
      : type === "book"
        ? /^OL[1-9][0-9]*W$/.test(id)
        : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
            id,
          ))
  )
    notFound();
  let item = null;
  try {
    item = await getPickById(type, id);
  } catch {}
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail pick-detail">
        <Link className="text-link" href="/">
          ← Back to your issue
        </Link>
        {item ? (
          <CulturalPickFeature key={item.id} item={item} detail />
        ) : (
          <>
            <h1>This discovery is unavailable for now.</h1>
            <p>Your magazine is still here.</p>
            <Link className="text-link" href={`/explore/${type}/${id}`}>
              Try again →
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
