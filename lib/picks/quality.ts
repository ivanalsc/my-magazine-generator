import type { CulturalPick } from "@/types/pick";
import { validPick } from "./model";

// Discovery quality is separate from snapshot validity: old Saved/Archive records
// remain readable even when they would not qualify as a new recommendation.
export function meaningfulText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length <= 500 &&
    /\p{L}/u.test(value) &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/^(?:\[?untitled\]?|unknown|unknown artist|anonymous|n\/?a|not available|test|undefined|null)$/i.test(
      value.trim(),
    )
  );
}
export function readableDisplay(value: unknown): value is string {
  if (!meaningfulText(value)) return false;
  const letters = value.match(/\p{L}/gu) ?? [];
  const latin = value.match(/\p{Script=Latin}/gu) ?? [];
  // This checks display readability, not English origin or nationality.
  return latin.length > 0 && latin.length / letters.length >= 0.8;
}
export function discoveryTitle(value: unknown): value is string {
  return (
    meaningfulText(value) &&
    !/^(?:isbn[ :\d-]|\[?(?:record deleted|no title|title unavailable)\]?)/i.test(
      value.trim(),
    ) &&
    !/\b(?:deluxe edition|anniversary edition|expanded edition|reissue|remastered edition)\b/i.test(
      value,
    )
  );
}
export function isDiscoveryPick(pick: CulturalPick): boolean {
  return (
    validPick(pick) &&
    discoveryTitle(pick.title) &&
    readableDisplay(pick.title) &&
    pick.creators.length > 0 &&
    pick.creators.every(meaningfulText)
  );
}
