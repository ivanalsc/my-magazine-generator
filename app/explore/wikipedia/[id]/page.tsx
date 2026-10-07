import Link from "next/link";
import { notFound } from "next/navigation";
import { getWikipediaDiscovery } from "@/lib/sources/wikipedia";
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
    return await getWikipediaDiscovery(Number(id));
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
      : "Wikipedia discovery",
    description: item?.description,
    openGraph: item
      ? {
          title: item.title,
          description: item.description,
          images: item.image ? [item.image.src] : [],
        }
      : undefined,
  };
}
export default async function WikipediaPage({ params }: Props) {
  const { id } = await params;
  const item = await load(id);
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="wiki-feature cultural-feature">
        <Link href="/" className="text-link">
          ← Back to your issue
        </Link>
        {!item ? (
          <div className="detail">
            <h1>This discovery is unavailable for now.</h1>
            <p>Wikipedia couldn’t provide a readable introduction.</p>
            <Link href={`/explore/wikipedia/${id}`} className="text-link">
              Try again →
            </Link>
          </div>
        ) : (
          <>
            <div className="cultural-feature-heading">
              <p className="eyebrow accent">Rabbit hole · Wikipedia</p>
              <h1>{item.title}</h1>
              <div className="feature-actions">
                <span className="meta">From Wikipedia contributors</span>
                <SaveButton item={item} />
              </div>
            </div>
            {item.image && (
              <figure className="wiki-figure">
                <EditorialPhoto image={item.image} priority />
                <figcaption>
                  <CulturalAttribution item={item} image />
                </figcaption>
              </figure>
            )}
            <div className="wiki-introduction">
              {item.extract
                .split(/\n+/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
            <div className="cultural-source-notes">
              <CulturalAttribution item={item} />
              <a
                href={item.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Continue on Wikipedia ↗
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
