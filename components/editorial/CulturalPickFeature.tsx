"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { EditorialPhoto } from "./Magazine";
import { SaveButton } from "@/components/saved/SaveButton";
import type { CulturalPick } from "@/types/pick";

export function CulturalPickFeature({
  item,
  detail = false,
  refreshControl,
}: {
  item: CulturalPick;
  detail?: boolean;
  refreshControl?: ReactNode;
}) {
  const Heading = detail ? "h1" : "h3";
  const label = {
    film: "Tonight’s pick",
    tv: "Tonight’s pick",
    book: "For your nightstand",
    album: "Listen to this",
  }[item.mediaType];
  return (
    <section
      className={`cultural-pick pick-${item.mediaType} ${item.image ? "pick-illustrated" : "pick-text"}`}
      aria-labelledby="pick-title"
      data-pick-id={item.id}
    >
      {!detail && (
        <header className="pick-folio">
          <h2>Cultural Pick</h2>
          <span>One thing to experience</span>
        </header>
      )}
      <div className="pick-composition">
        {item.image && (
          <Link
            className="pick-visual"
            href={item.internalUrl}
            aria-label={`Explore ${item.title}`}
          >
            <EditorialPhoto image={item.image} className="pick-image" />
          </Link>
        )}
        <div className="pick-copy">
          <p className="pick-kicker">{label}</p>
          <p className="eyebrow pick-format">
            {item.mediaType === "tv" ? "TV series" : item.mediaType}
          </p>
          <Heading id="pick-title">
            <Link href={item.internalUrl}>{item.title}</Link>
          </Heading>
          {item.creators.length > 0 && (
            <p className="pick-creators">{item.creators.join(", ")}</p>
          )}
          {item.year && <p className="pick-year">{item.year}</p>}
          {item.topics.length > 0 && (
            <p className="meta pick-subjects">
              {item.topics.slice(0, 3).join(" · ")}
            </p>
          )}
          {!detail && (
            <div className="pick-actions">
              <Link className="text-link" href={item.internalUrl}>
                Explore →
              </Link>
              {refreshControl}
            </div>
          )}
          <p className="license-small">
            {item.attribution} ·{" "}
            <a
              href={item.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.source.name} ↗
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <SaveButton item={item} />
        </div>
      </div>
    </section>
  );
}
