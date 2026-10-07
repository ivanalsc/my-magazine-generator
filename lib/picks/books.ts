import type { BookPick } from "@/types/pick";
import { seededOrder } from "@/lib/sources/selection";
import { isDiscoveryPick } from "./quality";
import {
  pickDiagnostic,
  safePickFailure,
  type PickDiagnostic,
} from "./diagnostics";
export const MAX_BOOK_SUBJECT_ATTEMPTS = 3;
const bookSubjects: Record<string, string> = {
  books: "literature",
  history: "history",
  psychology: "psychology",
  ideas: "philosophy",
  science: "science",
  technology: "technology",
  art: "art",
  design: "design",
  architecture: "architecture",
  photography: "photography",
  travel: "travel",
  food: "cooking",
  nature: "nature",
  music: "music",
  film: "cinema",
  creativity: "creativity",
};
export function orderedBookSubjects(interests: string[]): string[] {
  const subjects = [
    ...new Set(
      seededOrder([...new Set(interests)], "book-subject", (i) => i)
        .map((i) => bookSubjects[i])
        .filter(Boolean),
    ),
  ];
  return (subjects.length ? subjects : ["literature"]).slice(
    0,
    MAX_BOOK_SUBJECT_ATTEMPTS,
  );
}
export async function loadBookPool(
  interests: string[],
  getSubjectPool: (subject: string) => Promise<BookPick[]>,
  diagnostic: (event: PickDiagnostic) => void = (event) =>
    pickDiagnostic("book", event),
): Promise<BookPick[]> {
  for (const subject of orderedBookSubjects(interests)) {
    try {
      const usable = [
        ...new Map(
          (await getSubjectPool(subject))
            .filter(isDiscoveryPick)
            .map((p) => [p.id, p]),
        ).values(),
      ];
      diagnostic({
        subject,
        outcome: usable.length ? "success" : "empty",
        candidates: usable.length,
      });
      if (usable.length)
        return usable.map((item) => ({
          ...item,
          interestIds: interests.filter((i) => bookSubjects[i] === subject),
        }));
    } catch (error) {
      diagnostic({
        subject,
        outcome: "failure",
        reason: safePickFailure(error),
      });
    }
  }
  return [];
}
