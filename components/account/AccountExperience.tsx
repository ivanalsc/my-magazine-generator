"use client";
import { parsePreferences, PREFERENCES_KEY } from "@/lib/preferences";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagazineHeader } from "@/components/editorial/Magazine";
import {
  useAccountState,
  accountMutation,
  clearAccountSession,
} from "@/lib/repositories/account-store";
import { repositoryRequest } from "@/lib/repositories/http";
export function AccountExperience() {
  const account = useAccountState();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const data = account?.data;
  async function importDeviceInterests() {
    setPending(true);
    setError("");
    try {
      const prefs = parsePreferences(localStorage.getItem(PREFERENCES_KEY));
      if (!prefs) {
        setError("Choose your interests to start your library.");
        return;
      }
      const failure = await accountMutation("preferences", prefs);
      if (failure) setError(failure);
      else router.refresh();
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      await repositoryRequest("/auth/logout", "POST");
      clearAccountSession();
      router.replace("/");
      router.refresh();
    } catch {
      setError(
        "We couldn’t sign you out. Check your connection and try again.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail account-intro">
        <p className="eyebrow accent">Your library</p>
        <h1>Your Library.</h1>
        {account?.identity?.email && (
          <p className="account-email">
            Signed in as <span>{account.identity.email}</span>
          </p>
        )}
        <p>
          Your interests, saved discoveries and issues stay with your account,
          wherever you read.
        </p>
        {account?.mode === "guest" && (
          <p>
            <Link href="/sign-in" className="text-link">
              Sign in to keep your discoveries and issues →
            </Link>
          </p>
        )}
        {account?.mode === "loading" && (
          <p role="status">Opening your library…</p>
        )}
        {account?.mode === "account" && (
          <>
            {!data!.preferences && (
              <p>
                <button
                  type="button"
                  className="quiet-button"
                  disabled={pending}
                  onClick={() => void importDeviceInterests()}
                >
                  Use my interests from this device →
                </button>
              </p>
            )}
            <section className="library-links" aria-labelledby="library-title">
              <h2 id="library-title" className="eyebrow">
                Library
              </h2>
              <dl className="library-index">
                <div>
                  <dt>
                    <Link href="/saved">Saved</Link>
                  </dt>
                  <dd>
                    {data!.saved.length}{" "}
                    {data!.saved.length === 1 ? "clipping" : "clippings"} →
                  </dd>
                </div>
                <div>
                  <dt>
                    <Link href="/archive">Archive</Link>
                  </dt>
                  <dd>Your past issues →</dd>
                </div>
                <div>
                  <dt>
                    <Link href="/interests">Interests</Link>
                  </dt>
                  <dd>{data!.preferences?.interests.length ?? 0} selected →</dd>
                </div>
                <div>
                  <dt>
                    <Link href="/interests">Sources</Link>
                  </dt>
                  <dd>
                    {(data!.preferences?.sources.length ?? 0) +
                      (data!.preferences?.customSources.length ?? 0)}{" "}
                    selected publications →
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
        {account?.mode === "error" && (
          <p>
            Reconnect to open your library. Your guest data is still on this
            device.
          </p>
        )}
        {(account?.identity || account?.mode === "account") && (
          <div className="account-actions">
            <Link href="/" className="text-link">
              Today’s issue →
            </Link>
            <button
              className="quiet-button"
              disabled={pending}
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
