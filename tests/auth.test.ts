import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  normalizeEmail,
  maskEmail,
  safeAuthDiagnostic,
  emailRequestError,
} from "../lib/account/presentation";

test("email send limits explain delivery throttling without exposing backend messages", () => {
  for (const error of [
    { status: 429 },
    { code: "over_email_send_rate_limit" },
    { code: "over_request_rate_limit" },
  ]) {
    assert.match(emailRequestError(error), /temporary sending limit/);
    assert.match(emailRequestError(error), /inbox and spam/);
  }
  assert.match(
    emailRequestError({ status: 500, message: "private backend details" }),
    /Check your connection/,
  );
  assert.ok(
    !emailRequestError({
      status: 500,
      message: "private backend details",
    }).includes("private backend"),
  );
});
import {
  AccountStateContext,
  hydrateAccount,
  clearAccountSession,
  accountSavedHasKey,
  persistenceMode,
} from "../lib/repositories/account-store";
import { MagazineHeader } from "../components/editorial/Magazine";
import type { AccountState } from "../lib/repositories/models";
test("email validation and masked confirmation never retain the complete local part", () => {
  assert.equal(normalizeEmail("  reader@example.com  "), "reader@example.com");
  for (const input of [
    "",
    "invalid",
    "a@",
    "a b@example.com",
    "a@@example.com",
  ])
    assert.equal(normalizeEmail(input), null);
  assert.equal(maskEmail("reader@example.com"), "re***@example.com");
  assert.equal(maskEmail("a@example.com"), "***@example.com");
  assert.equal(maskEmail("ab@example.com"), "a***@example.com");
});
test("development auth diagnostics omit emails, tokens and raw internal messages", () => {
  assert.deepEqual(
    safeAuthDiagnostic({
      name: "AuthApiError",
      code: "otp_expired",
      status: 403,
      message: "Sensitive message",
      email: "private@example.com",
      token: "private-token",
    }),
    { name: "AuthApiError", code: "otp_expired", status: 403 },
  );
});
function header(state: AccountState) {
  return renderToStaticMarkup(
    createElement(
      AccountStateContext.Provider,
      { value: state },
      createElement(MagazineHeader),
    ),
  );
}
test("server-provided session renders the correct editorial account action without guessing during loading", () => {
  const guest = header({ mode: "guest" });
  assert.ok(guest.includes('href="/sign-in"'));
  assert.ok(guest.includes(">Sign in</a>"));
  assert.ok(!guest.includes("My Library"));
  const signed = header({
    mode: "loading",
    identity: { userId: "verified-owner", email: "reader@example.com" },
  });
  assert.ok(signed.includes('href="/account"'));
  assert.ok(signed.includes(">Account</a>"));
  assert.ok(!signed.includes(">Sign in</a>"));
  assert.ok(!signed.includes("reader@example.com"));
  const resolving = header({ mode: "loading" });
  assert.ok(!resolving.includes(">Sign in</a>"));
  assert.ok(resolving.includes("Resolving your library"));
});
test("logout clears account state immediately while leaving guest localStorage untouched", () => {
  hydrateAccount({
    mode: "loading",
    identity: { userId: "owner", email: "reader@example.com" },
  });
  assert.equal(persistenceMode(), "loading");
  clearAccountSession();
  assert.equal(persistenceMode(), "guest");
  assert.equal(accountSavedHasKey("anything"), false);
});
