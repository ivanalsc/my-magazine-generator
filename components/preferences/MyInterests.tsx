"use client";
import Link from "next/link";
import { useAccountState } from "@/lib/repositories/account-store";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { PreferenceLoading } from "@/components/preferences/PreferenceLoading";
import { sourceCatalog } from "@/data/catalog";
import {
  selectedInterestNames,
  sourcesForPreferences,
} from "@/lib/preferences";
import {
  clearPreferences,
  useMagazinePreferences,
} from "@/lib/useMagazinePreferences";
export function MyInterests() {
  const { ready, preferences } = useMagazinePreferences();
  const account = useAccountState();
  const router = useRouter();
  const [error, setError] = useState("");
  if (!ready) return <PreferenceLoading />;
  async function reset() {
    const error = await clearPreferences();
    if (error) {
      setError(error);
      return;
    }
    router.push("/");
    router.refresh();
  }
  return (
    <div className="magazine-shell">
      <MagazineHeader active="interests" />
      <main id="main-content" className="my-interests">
        <p className="eyebrow accent">Your magazine is made from</p>
        <h1>A collection of your curiosities.</h1>
        {account?.mode === "guest" && preferences && (
          <p className="persistence-hint">
            These preferences are saved on this device.{" "}
            <Link href="/sign-in">Sign in to use them everywhere →</Link>
          </p>
        )}
        {preferences ? (
          <>
            <section aria-labelledby="your-interests">
              <div className="preferences-section-heading">
                <h2 id="your-interests">Your interests</h2>
                <Link className="text-link" href="/onboarding?edit=1">
                  Edit interests →
                </Link>
              </div>
              <ul className="review-interest-index">
                {selectedInterestNames(preferences).map((name, i) => (
                  <li key={name}>
                    <span className="index-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{name}</span>
                    <span className="accent" aria-hidden="true">
                      ✓
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="your-sources">
              <div className="preferences-section-heading">
                <h2 id="your-sources">Sources</h2>
                <Link
                  className="text-link"
                  href="/onboarding?step=sources&edit=1"
                >
                  Edit sources →
                </Link>
              </div>
              {preferences.sources.length + preferences.customSources.length ===
              0 ? (
                <>
                  <p className="curated-source-note">
                    You’re leaving room for discovery. Your magazine uses our
                    curated catalog around your interests.
                  </p>
                  <p className="meta">
                    {sourcesForPreferences(preferences)
                      .map((source) => source.name)
                      .join(" · ")}
                  </p>
                </>
              ) : (
                <ul className="review-sources">
                  {sourceCatalog
                    .filter((source) => preferences.sources.includes(source.id))
                    .map((source) => (
                      <li key={source.id}>
                        <span>{source.name}</span>
                        <small>{source.description}</small>
                      </li>
                    ))}
                  {preferences.customSources.map((source) => (
                    <li key={source.id}>
                      <span>{source.name}</span>
                      <small>Added by you · {source.websiteUrl}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="preferences-bottom">
              <Link href="/" className="text-link">
                Return to today’s issue →
              </Link>
              <div>
                <button
                  type="button"
                  className="quiet-button reset-button"
                  onClick={reset}
                >
                  Reset preferences & start again
                </button>
                <p className="meta">
                  Clears your active interests and sources. Saved stays in your
                  library.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <p>You haven’t chosen your interests yet.</p>
            <Link className="editorial-button" href="/">
              Make my magazine →
            </Link>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
