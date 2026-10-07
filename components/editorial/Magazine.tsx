"use client";
import { CulturalAttribution } from "./CulturalAttribution";
import Image from "next/image";
import { useAccountState } from "@/lib/repositories/account-store";
import { useState } from "react";
import { SaveButton } from "@/components/saved/SaveButton";
import Link from "next/link";
import type {
  EditorialStory,
  CulturalItem,
  EditorialImage,
} from "@/types/editorial";
export function MagazineHeader({
  active = "issue",
  compact = false,
  date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()),
  number = "001",
}: {
  active?: "issue" | "archive" | "saved" | "interests" | "";
  compact?: boolean;
  date?: string;
  number?: string;
}) {
  const account = useAccountState();
  const signedIn = !!account?.identity || account?.mode === "account";
  const accountLabel = signedIn
    ? "Account"
    : account?.mode === "guest"
      ? "Sign in"
      : null;
  return (
    <header className={`magazine-header ${compact ? "header-compact" : ""}`}>
      <div className="topline">
        <span>Curated, never rewritten.</span>
        <span>
          {compact && accountLabel ? (
            <Link href={signedIn ? "/account" : "/sign-in"}>
              {accountLabel}
            </Link>
          ) : (
            "A magazine around you."
          )}
        </span>
      </div>
      <Link
        className="masthead"
        href="/"
        aria-label="My Magazine Generator home"
      >
        <span>MY MAGAZINE</span>{" "}
        <span>
          GENERATOR
          <span className="masthead-dot" aria-hidden="true">
            *
          </span>
        </span>
      </Link>
      {!compact && (
        <div className="header-bottom">
          <nav aria-label="Main navigation">
            {[
              { label: "Today’s Issue", href: "/", id: "issue" },
              { label: "Archive", href: "/archive", id: "archive" },
              { label: "Saved", href: "/saved", id: "saved" },
              { label: "My Interests", href: "/interests", id: "interests" },
            ].map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active === item.id ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <time dateTime={date}>
            {new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
          <div className="header-right">
            <span className="issue-number">Issue {number}</span>
            <span className="header-account">
              {accountLabel ? (
                <Link href={signedIn ? "/account" : "/sign-in"}>
                  {accountLabel}
                </Link>
              ) : (
                <span className="sr-only" role="status">
                  Resolving your library
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}

export function SectionHeader({
  title,
  number,
}: {
  title: string;
  number?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {number && <span>{number}</span>}
    </div>
  );
}
export function ExternalLink({
  article,
  children,
  className,
}: {
  article: EditorialStory;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={article.url}
      aria-label={
        className?.includes("image")
          ? `${article.title} (opens original publication in a new tab)`
          : undefined
      }
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
      <span className="sr-only">
        {" "}
        (opens{" "}
        {article.source.isMock
          ? "fictional publisher demo"
          : "original publication"}{" "}
        in a new tab)
      </span>
    </a>
  );
}
export function EditorialPhoto({
  image,
  priority = false,
  className = "",
}: {
  image: EditorialImage;
  priority?: boolean;
  className?: string;
}) {
  return (
    <PhotoResource
      key={image.src}
      image={image}
      priority={priority}
      className={className}
    />
  );
}
function PhotoResource({
  image,
  priority,
  className,
}: {
  image: EditorialImage;
  priority: boolean;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  if (/^https?:/.test(image.src))
    return (
      <div className={`photo ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Feed images are direct browser resources, never proxied through Next image optimization. */}
        <img
          src={image.src}
          alt={image.alt}
          loading={priority ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  return (
    <div className={`photo ${className}`}>
      <Image
        src={image.src}
        alt={image.alt}
        fill
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        sizes="(max-width: 700px) 100vw, (max-width: 1100px) 65vw, 850px"
      />
    </div>
  );
}
export function SourceLine({ article }: { article: EditorialStory }) {
  return (
    <div className="source-line">
      <ExternalLink article={article}>{article.source.name} ↗</ExternalLink>
      {article.readingTime && <span>{article.readingTime} min read</span>}
      <SaveButton item={article} />
    </div>
  );
}
export function LeadStory({ article }: { article: EditorialStory }) {
  return (
    <section className="lead-section" aria-labelledby="lead-heading">
      <article className="lead-story">
        <div className="lead-copy">
          <p className="eyebrow accent">
            The opening story · {article.category}
          </p>
          <h2 id="lead-heading">
            <ExternalLink article={article}>{article.title}</ExternalLink>
          </h2>
          <SourceLine article={article} />
          {article.excerpt && <p>{article.excerpt}</p>}
          <ExternalLink article={article} className="text-link">
            Read story ↗
          </ExternalLink>
        </div>
        {article.image && (
          <ExternalLink article={article} className="lead-image">
            <EditorialPhoto image={article.image} priority />
          </ExternalLink>
        )}
      </article>
      <div className="lead-caption">
        <span>{article.category}</span>
        {article.image?.credit && <span>Image: {article.image.credit}</span>}
      </div>
    </section>
  );
}
export function Story({
  article,
  variant = "standard",
  headingLevel = 3,
}: {
  article: EditorialStory;
  variant?: "standard" | "large" | "compact" | "text";
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className={`story story-${variant}`}>
      {article.image && (
        <ExternalLink article={article} className="story-image">
          <EditorialPhoto image={article.image} />
        </ExternalLink>
      )}
      <p className="eyebrow">{article.category}</p>
      <Heading>
        <ExternalLink article={article}>{article.title}</ExternalLink>
      </Heading>
      {article.excerpt && <p className="excerpt">{article.excerpt}</p>}
      <SourceLine article={article} />
    </article>
  );
}
export function RabbitHole({ item }: { item: CulturalItem }) {
  return (
    <section className="rabbit-hole" aria-labelledby="rabbit-heading">
      <div className="rabbit-intro">
        <p className="eyebrow">A good place to get lost</p>
        <h2 id="rabbit-heading">
          Rabbit
          <br />
          hole<span aria-hidden="true">↘</span>
        </h2>
        <p className="meta">One discovery. Many directions.</p>
      </div>
      <article className="rabbit-content">
        <div>
          <p className="eyebrow">From Wikipedia</p>
          <h3>
            <Link href={item.internalUrl}>{item.title}</Link>
          </h3>
          <p>{item.description}</p>
          <Link className="text-link" href={item.internalUrl}>
            Explore →
          </Link>
          <CulturalAttribution item={item} />
          <CulturalAttribution item={item} image />
          <SaveButton item={item} />
        </div>
        {item.image && (
          <Link
            href={item.internalUrl}
            className="manuscript"
            aria-label={`Explore ${item.title}`}
          >
            <EditorialPhoto image={item.image} />
          </Link>
        )}
      </article>
    </section>
  );
}
export function ArtworkFeature({ item }: { item: CulturalItem }) {
  return (
    <section
      className="artwork-feature"
      data-artwork-id={item.id}
      aria-labelledby="artwork-heading"
    >
      <SectionHeader
        title="Artwork of the issue"
        number="A moment in the museum"
      />
      <Link
        href={item.internalUrl}
        aria-label={`Explore artwork: ${item.title}`}
      >
        {item.image && (
          <EditorialPhoto image={item.image} className="artwork-image" />
        )}
      </Link>
      <div className="artwork-caption">
        <div>
          <h3 id="artwork-heading">
            <Link href={item.internalUrl}>{item.title}</Link>
          </h3>
          <p>{[item.artist, item.year].filter(Boolean).join(", ")}</p>
        </div>
        <div>
          <p>{item.source.name}</p>
          <CulturalAttribution item={item} />
          <Link className="text-link" href={item.internalUrl}>
            Explore artwork →
          </Link>
          <SaveButton item={item} />
        </div>
      </div>
    </section>
  );
}
export function OnThisDay({ item }: { item: CulturalItem }) {
  return (
    <section className="on-this-day" aria-labelledby="history-heading">
      <SectionHeader title="On this day" />
      <div className="history-content">
        <div>
          <p className="eyebrow">October 6</p>
          <p className="history-year">{item.year}</p>
        </div>
        <article>
          <h3 id="history-heading">
            <Link href={item.internalUrl}>{item.title}</Link>
          </h3>
          <p>{item.description}</p>
          <Link className="text-link" href={item.internalUrl}>
            Discover →
          </Link>
          <p className="license-small">From Wikipedia · CC BY-SA 4.0</p>
          <SaveButton item={item} />
        </article>
      </div>
    </section>
  );
}
export function OutsideBubble({
  article,
  isOutside = true,
}: {
  article: EditorialStory;
  isOutside?: boolean;
}) {
  return (
    <section className="outside-bubble" aria-labelledby="outside-heading">
      <div className="section-heading">
        <h2 id="outside-heading">Outside your bubble</h2>
        <span aria-hidden="true">✳</span>
      </div>
      <p className="meta">
        {isOutside
          ? "Something outside your usual interests."
          : "A different corner of this issue."}
      </p>
      <Story article={article} variant="compact" />
    </section>
  );
}
export function IssueEnd({ number = "001" }: { number?: string }) {
  return (
    <footer className="issue-end">
      <span className="end-mark" aria-hidden="true">
        ✳
      </span>
      <p className="eyebrow">End of issue {number}</p>
      <h2>You’ve reached the end.</h2>
      <Link href="/archive" className="text-link">
        Issue archive ←
      </Link>
      <div className="footer-line">
        <Link href="/">My Magazine Generator</Link>
        <span>Curated, never rewritten.</span>
        <Link href="/about">About this prototype →</Link>
      </div>
      <Link href="/sources" className="text-link">
        Sources & attribution →
      </Link>
    </footer>
  );
}
