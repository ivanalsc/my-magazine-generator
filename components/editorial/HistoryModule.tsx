import Link from "next/link";
import { SectionHeader } from "./Magazine";
import type { HistoricalEvent } from "@/types/cultural";
export function HistoryModule({
  events,
  date,
}: {
  events: HistoricalEvent[];
  date: string;
}) {
  if (!events.length) return null;
  return (
    <section
      className="on-this-day real-history"
      aria-labelledby="history-title"
    >
      <div id="history-title">
        <SectionHeader
          title="On this day"
          number={new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        />
      </div>
      {events.map((event) => (
        <article className="history-event" key={event.id}>
          <p className="history-year">{event.year}</p>
          <div>
            <h3>{event.text}</h3>
            {event.relatedPage && (
              <Link href={event.relatedPage.internalUrl} className="text-link">
                {event.relatedPage.title} →
              </Link>
            )}
            <p className="license-small">
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Wikipedia contributors ↗
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0 ↗
              </a>
            </p>
          </div>
        </article>
      ))}
    </section>
  );
}
