"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MagazineIssueView } from "@/components/editorial/IssueExperience";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { issuesRepository } from "@/lib/repositories/issues";
import { useAccountState } from "@/lib/repositories/account-store";
import type { IssueEnvelope } from "@/lib/repositories/models";
export function ArchivedIssue({ id }: { id: string }) {
  const account = useAccountState();
  const userId = account?.data?.userId;
  const [result, setResult] = useState<{
    id: string;
    userId: string;
    issue?: IssueEnvelope;
    error?: string;
  }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    issuesRepository
      .get(id)
      .then((issue) => {
        if (active) setResult({ id, userId, issue });
      })
      .catch((error) => {
        if (active) setResult({ id, userId, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [id, userId, attempt]);
  if (
    account?.mode === "account" &&
    result?.id === id &&
    result.userId === userId &&
    result.issue
  )
    return (
      <MagazineIssueView
        preferences={result.issue.preferences}
        response={result.issue}
        archived
      />
    );
  return (
    <div className="magazine-shell">
      <MagazineHeader active="archive" />
      <main id="main-content" className="detail">
        <p className="eyebrow">From your archive</p>
        <h1>
          {account?.mode === "guest"
            ? "Your library is personal."
            : "Opening your issue."}
        </h1>
        {account?.mode === "guest" ? (
          <Link className="text-link" href="/sign-in">
            Sign in to open this issue →
          </Link>
        ) : result?.error ? (
          <>
            <p role="alert">{result.error}</p>
            <button
              className="quiet-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again →
            </button>
          </>
        ) : (
          <p role="status">
            {account?.mode === "error"
              ? "Reconnect to open your issue."
              : "Retrieving your final selection…"}
          </p>
        )}
        <Link href="/archive" className="text-link">
          Return to the archive →
        </Link>
      </main>
    </div>
  );
}
