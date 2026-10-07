"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { useAccountState } from "@/lib/repositories/account-store";
import { issuesRepository } from "@/lib/repositories/issues";
import { selectedInterestNames } from "@/lib/preferences";
import type { IssueSummary } from "@/lib/repositories/models";
export function ArchiveExperience() {
  const account = useAccountState();
  const userId = account?.data?.userId;
  const [result, setResult] = useState<{
    userId: string;
    items?: IssueSummary[];
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    issuesRepository
      .list()
      .then((items) => {
        if (active) setResult({ userId, items });
      })
      .catch((error) => {
        if (active) setResult({ userId, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [userId, attempt]);
  return (
    <div className="magazine-shell">
      <MagazineHeader
        active="archive"
        date={result?.userId === userId ? result?.items?.[0]?.date : undefined}
        number={
          result?.userId === userId ? result?.items?.[0]?.number : undefined
        }
      />
      <main id="main-content" className="archive-page">
        <p className="eyebrow accent">Archive</p>
        <h1>
          {account?.mode === "guest"
            ? "Every issue deserves a shelf."
            : "Your previous issues."}
        </h1>
        <p className="archive-intro">
          {account?.mode === "guest"
            ? "Sign in to keep each issue you receive and return to it later."
            : "A shelf of curiosities. Every issue keeps the selection you received that day."}
        </p>
        {!account || account.mode === "loading" ? (
          <p role="status">Opening your library…</p>
        ) : account.mode === "guest" ? (
          <div className="archive-empty guest-archive">
            <h2>Your issues, kept together.</h2>
            <p>Sign in to keep each issue and return to it later.</p>
            <Link className="text-link" href="/sign-in">
              Sign in to keep your issues →
            </Link>
            <Link className="text-link" href="/">
              Continue reading today’s issue →
            </Link>
          </div>
        ) : account.mode === "error" ? (
          <p role="alert">Reconnect to open your archive.</p>
        ) : !result || result.userId !== userId ? (
          <p role="status">Taking your issues off the shelf…</p>
        ) : result.error ? (
          <>
            <p role="alert">{result.error}</p>
            <button
              className="quiet-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again →
            </button>
          </>
        ) : result.items?.length ? (
          <ol className="archive-shelf">
            {result.items.map((issue, index) => (
              <li
                key={issue.id}
                className={index === 0 ? "archive-latest" : ""}
              >
                <Link href={`/issue/${issue.id}`}>
                  <span className="eyebrow">Issue {issue.number}</span>
                  <h2>
                    {new Date(`${issue.date}T12:00:00`).toLocaleDateString(
                      "en-US",
                      { month: "long", day: "numeric", year: "numeric" },
                    )}
                  </h2>
                  <p>{selectedInterestNames(issue.preferences).join(" · ")}</p>
                  <span className="meta">{issue.pieces} pieces</span>
                  <span className="text-link">Open issue →</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <div className="archive-empty">
            <h2>Your first issue is waiting.</h2>
            <Link className="text-link" href="/">
              Open today’s issue →
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
