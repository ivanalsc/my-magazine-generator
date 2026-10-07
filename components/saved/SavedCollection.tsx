"use client";

import Link from "next/link";

import { CulturalAttribution } from "@/components/editorial/CulturalAttribution";

import { useAccountState } from "@/lib/repositories/account-store";
import { useSaved } from "@/lib/storage/saved";

import {
  MagazineHeader,
  Story,
  EditorialPhoto,
} from "@/components/editorial/Magazine";

import { SaveButton } from "./SaveButton";

export function SavedCollection() {
  const { ready, items } = useSaved();
  const account = useAccountState();

  return (
    <div className="magazine-shell">
      <MagazineHeader active="saved" />

      <main id="main-content" className="saved-page">
        <p className="eyebrow accent">Saved</p>

        <h1>Things worth coming back to.</h1>

        {account?.mode === "guest" && (
          <div className="saved-empty">
            <p>Sign in to build your personal collection.</p>
            <Link href="/sign-in" className="text-link">
              Sign in →
            </Link>
          </div>
        )}
        {account?.mode === "guest" ? null : !ready ? (
          <p role="status">Opening your collection…</p>
        ) : !items.length ? (
          <div className="saved-empty">
            <h2>Nothing saved yet.</h2>

            <p>Things you save from your magazine will appear here.</p>

            <Link className="text-link" href="/">
              Today’s issue →
            </Link>
          </div>
        ) : (
          <>
            <p className="meta">
              {items.length} things kept
              {account?.mode === "account" ? " · In your account library" : ""}
            </p>

            <div className="saved-grid">
              {items.map((entry, index) => (
                <div
                  className={`saved-entry saved-${entry.kind}`}

                  key={entry.key}
                >
                  <p className="eyebrow saved-date">
                    {entry.kind === "externalArticle" ? "Article · " : ""}Kept{" "}
                    {new Date(entry.savedAt).toLocaleDateString("en-US", {
                      month: "short",

                      day: "numeric",

                      year: "numeric",
                    })}
                  </p>

                  {entry.kind === "externalArticle" ? (
                    <Story
                      article={entry.item}

                      headingLevel={2}

                      variant={index % 3 === 0 ? "large" : "text"}
                    />
                  ) : (
                    <article className="story">
                      {entry.item.image && (
                        <Link
                          href={entry.item.internalUrl}

                          aria-label={`Explore ${entry.item.title}`}
                        >
                          <EditorialPhoto
                            image={entry.item.image}

                            className={
                              entry.kind === "artwork"
                                ? "saved-artwork-image"
                                : ""
                            }
                          />
                        </Link>
                      )}

                      <p className="eyebrow">
                        {entry.kind === "wikipediaDiscovery"
                          ? "Wikipedia"
                          : entry.kind === "artwork"
                            ? "Artwork"
                            : entry.item.kind.replace("-", " ")}
                      </p>

                      <h2>
                        <Link
                          href={entry.item.internalUrl}

                          aria-label={`Explore ${entry.item.title}`}
                        >
                          {entry.item.title}
                        </Link>
                      </h2>

                      <p>
                        {entry.item.artist}

                        {entry.item.year && ` · ${entry.item.year}`}
                      </p>

                      <CulturalAttribution item={entry.item} />

                      {entry.kind === "wikipediaDiscovery" &&
                        entry.item.image && (
                          <CulturalAttribution item={entry.item} image />
                        )}

                      <Link href={entry.item.internalUrl} className="text-link">
                        Explore →
                      </Link>

                      <SaveButton item={entry.item} />
                    </article>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
