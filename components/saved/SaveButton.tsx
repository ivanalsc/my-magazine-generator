"use client";
import Link from "next/link";
import { useAccountState } from "@/lib/repositories/account-store";
import { useState } from "react";
import { savedKey, toggleSaved, useSaved } from "@/lib/storage/saved";
import type { CulturalItem, EditorialStory } from "@/types/editorial";
export function SaveButton({ item }: { item: EditorialStory | CulturalItem }) {
  const { items, ready } = useSaved();
  const account = useAccountState();
  const [invitation, setInvitation] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = items.some((entry) => entry.key === savedKey(item));
  return (
    <span className="save-control">
      <button
        type="button"
        className="save-button"
        disabled={!ready || pending}
        aria-pressed={saved}
        aria-label={`${saved ? "Remove from Saved" : "Save"}: ${item.title}`}
        onClick={async () => {
          if (account?.mode === "guest") {
            setInvitation(true);
            return;
          }
          setPending(true);
          setError(await toggleSaved(item));
          setPending(false);
        }}
      >
        <svg
          width="12"
          height="15"
          viewBox="0 0 12 15"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path d="M1 1h10v12L6 10l-5 3z" />
        </svg>
        {saved ? "Saved" : "Save"}
      </button>
      {invitation && account?.mode === "guest" && (
        <span className="save-invitation" role="status">
          <strong>Keep this for later</strong>
          <span>Sign in to build your personal collection.</span>
          <Link
            className="text-link"
            href={`/sign-in?next=${encodeURIComponent("internalUrl" in item ? item.internalUrl : "/")}`}
          >
            Sign in →
          </Link>
          <button
            type="button"
            className="quiet-button"
            onClick={() => setInvitation(false)}
            aria-label="Dismiss sign-in invitation"
          >
            Close
          </button>
        </span>
      )}
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
