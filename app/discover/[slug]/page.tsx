import Link from "next/link";
import { SaveButton } from "@/components/saved/SaveButton";
import { notFound } from "next/navigation";
import { culturalItems } from "@/data/mock/issue";
import {
  EditorialPhoto,
  MagazineHeader,
} from "@/components/editorial/Magazine";
export function generateStaticParams() {
  return culturalItems.map((item) => ({ slug: item.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `${culturalItems.find((item) => item.id === slug)?.title ?? "Discovery"} — My Magazine Generator`,
  };
}
export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = culturalItems.find((item) => item.id === slug);
  if (!item) notFound();
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail">
        <Link href="/" className="text-link">
          ← Back to your issue
        </Link>
        <p className="eyebrow">
          {item.kind.replace("-", " ")} · From {item.source.name}
        </p>
        <h1>{item.title}</h1>
        {item.image && <EditorialPhoto image={item.image} priority />}
        {item.artist && (
          <p>
            {item.artist}, {item.year}
          </p>
        )}
        {item.kind === "history" && <p>October 6, {item.year}</p>}
        {item.description && <p>{item.description}</p>}
        <p className="license-small">{item.attribution}</p>
        <SaveButton item={item} />
        <p>
          <a
            href={item.source.license?.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {item.source.license?.name} ↗
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
        {item.image && (
          <p className="license-small">
            Image:{" "}
            <a
              href={item.image.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.image.credit} ↗
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            · {item.image.license}
          </p>
        )}
        <a
          href={item.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          View original source ↗
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </main>
    </div>
  );
}
