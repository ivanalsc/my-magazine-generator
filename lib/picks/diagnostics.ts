import type { PickType } from "./model";
export class PickHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Cultural provider status ${status}`);
    this.name = "PickHttpError";
  }
}
export function safePickFailure(error: unknown): string {
  if (error instanceof PickHttpError)
    return `HTTP ${error.status} (${Math.floor(error.status / 100)}xx)`;
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return "timeout";
  if (error instanceof SyntaxError) return "invalid response";
  // Never print arbitrary messages, URLs, headers, emails or provider payloads.
  return "provider/network error";
}
export type PickDiagnostic = { subject?: string } & (
  | { outcome: "success"; candidates: number }
  | { outcome: "empty"; candidates: number }
  | { outcome: "failure"; reason: string }
  | { outcome: "unavailable"; reason: "missing credentials" }
);
export function formatPickDiagnostic(
  type: PickType,
  event: PickDiagnostic,
): string {
  const subject =
    event.subject && /^[a-z-]{1,30}$/.test(event.subject)
      ? ` subject=${event.subject}`
      : "";
  const outcome =
    event.outcome === "success"
      ? `success, ${event.candidates} candidates`
      : event.outcome === "empty"
        ? "0 normalized candidates"
        : event.outcome === "unavailable"
          ? "missing credentials"
          : /^(?:timeout|invalid response|provider\/network error|HTTP [1-5][0-9]{2} \([1-5]xx\))$/.test(
                event.reason,
              )
            ? event.reason
            : "provider/network error";
  return `[cultural-pick] ${type}${subject} → ${outcome}`;
}
export function pickDiagnostic(type: PickType, event: PickDiagnostic) {
  if (process.env.NODE_ENV === "development")
    console.info(formatPickDiagnostic(type, event));
}
