import Link from "next/link";
import { notFound } from "next/navigation";
import { getMetArtwork } from "@/lib/sources/met";
import {
  MagazineHeader,
  EditorialPhoto,
} from "@/components/editorial/Magazine";
import { CulturalAttribution } from "@/components/editorial/CulturalAttribution";
import { SaveButton } from "@/components/saved/SaveButton";
type Props = { params: Promise<{ id: string }> };
async function load(id: string) {
  if (!/^[1-9][0-9]{0,8}$/.test(id)) notFound();
  try {
    return await getMetArtwork(Number(id));
  } catch {
    return null;
  }
}
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const item = await load(id);
  return {
    title: item
      ? `${item.title} — My Magazine Generator`
      : "Artwork — My Magazine Generator",
    openGraph: item
      ? { title: item.title, images: item.image ? [item.image.src] : [] }
      : undefined,
  };
}
export default async function ArtworkPage({ params }: Props) {
  const { id } = await params;
  const item = await load(id);
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="museum-feature cultural-feature">
        <Link href="/" className="text-link">
          ← Back to your issue
        </Link>
        {!item ? (
          <div className="detail">
            <h1>This artwork is unavailable for now.</h1>
            <p>
              A reusable object with an image couldn’t be loaded from The Met.
            </p>
            <Link href={`/explore/artwork/${id}`} className="text-link">
              Try again →
            </Link>
          </div>
        ) : (
          <>
            <div className="museum-heading">
              <p className="eyebrow accent">
                Artwork · The Metropolitan Museum of Art
              </p>
              <h1>{item.title}</h1>
              <p>{[item.artist, item.year].filter(Boolean).join(" · ")}</p>
              <SaveButton item={item} />
            </div>
            {item.image && (
              <figure className="museum-figure">
                <EditorialPhoto
                  image={item.image}
                  priority
                  className="museum-image"
                />
                <figcaption>
                  {[item.title, item.artist, item.year, item.medium]
                    .filter(Boolean)
                    .join(" · ")}
                </figcaption>
              </figure>
            )}
            <div className="museum-object-notes">
              <dl>
                {[
                  ["Artist", item.artist],
                  ["Date", item.year],
                  ["Medium", item.medium],
                  ["Department", item.department],
                  ["Culture", item.culture],
                  ["Dimensions", item.dimensions],
                  ["Accession", item.accessionNumber],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              <div>
                <CulturalAttribution item={item} />
                <a
                  href={item.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  View at The Met ↗
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
