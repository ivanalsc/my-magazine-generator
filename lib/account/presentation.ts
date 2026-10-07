export function normalizeEmail(input: string): string | null {
  const email = input.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : null;
}
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, Math.min(2, Math.max(0, local.length - 1)))}***@${domain}`;
}
export function safeAuthDiagnostic(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : {};
  return {
    name: typeof value.name === "string" ? value.name : "UnknownError",
    code: typeof value.code === "string" ? value.code : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
  };
}
export function emailRequestError(error: unknown) {
  const details = safeAuthDiagnostic(error);
  if (
    details.status === 429 ||
    details.code === "over_email_send_rate_limit" ||
    details.code === "over_request_rate_limit"
  )
    return "Sign-in emails have reached a temporary sending limit. If you already requested a link, check your inbox and spam folder. Otherwise, please try again later.";
  return "We couldn’t send your sign-in link. Check your connection and try again in a moment.";
}
