"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { sendMagicLink } from "@/lib/supabase/browser";
import { supabaseConfig } from "@/lib/supabase/config";
import { normalizeEmail, maskEmail } from "@/lib/account/presentation";
export function SignInExperience({
  callbackError = false,
}: {
  callbackError?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (sent) heading.current?.focus();
  }, [sent]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    const valid = normalizeEmail(email);
    if (!valid) {
      setError("Enter a complete email address, such as you@example.com.");
      input.current?.focus();
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      await sendMagicLink(valid);
      setSent(maskEmail(valid));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "We couldn’t send your link. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail sign-in-page">
        <p className="eyebrow accent">
          {sent ? "Check your inbox" : "Your personal library"}
        </p>
        <h1 ref={heading} tabIndex={-1}>
          {sent
            ? "Your library is one link away."
            : "Your magazine, wherever you read it."}
        </h1>
        {sent ? (
          <section
            className="sign-in-confirmation"
            aria-labelledby="sent-description"
          >
            <p id="sent-description" role="status">
              We requested a sign-in link for <strong>{sent}</strong>.
            </p>
            <p>
              Check your inbox and spam folder. Open the most recent link to
              enter your magazine library.
            </p>
            <button
              className="quiet-button"
              onClick={() => {
                setSent(undefined);
                setError("");
                requestAnimationFrame(() => input.current?.focus());
              }}
            >
              Use another email
            </button>
          </section>
        ) : (
          <>
            {callbackError && (
              <section className="callback-error" role="alert">
                <h2>This link has expired or couldn’t be verified.</h2>
                <p>Request a new sign-in link to continue.</p>
              </section>
            )}
            <p className="sign-in-description">
              Sign in to keep your interests, saved discoveries and past issues
              across devices.
            </p>
            {supabaseConfig() ? (
              <form noValidate onSubmit={submit} className="account-form">
                <label htmlFor="sign-in-email">Email address</label>
                <input
                  ref={input}
                  id="sign-in-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  disabled={pending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? "sign-in-error" : "sign-in-help"}
                />
                <button className="editorial-button" disabled={pending}>
                  {pending ? "Sending your link…" : "Send me a sign-in link →"}
                </button>
                <p id="sign-in-help" className="meta">
                  No password. Just a link to your library.
                </p>
                {error && (
                  <p id="sign-in-error" role="alert" className="form-error">
                    {error}
                  </p>
                )}
              </form>
            ) : (
              <p className="meta">
                Sign-in is temporarily unavailable. You can still read your
                magazine as a guest.
              </p>
            )}
            <p className="sign-in-account-note">
              No account yet? Entering your email creates one automatically.
            </p>
          </>
        )}
        <div className="sign-in-guest">
          <p>You can continue using the magazine without signing in.</p>
          <Link href="/" className="text-link">
            Continue as guest →
          </Link>
        </div>
      </main>
    </div>
  );
}
