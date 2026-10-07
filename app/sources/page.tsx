import { TmdbCredit } from "@/components/editorial/TmdbCredit";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { enabledSources } from "@/lib/sources/registry";
export default function SourcesPage() {
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail">
        <p className="eyebrow accent">Sources & attribution</p>
        <h1>Curated. Never rewritten.</h1>
        <p>
          External editorial content belongs to its publishers. Stories open at
          the original publication in a new tab. We never republish full
          publisher articles.
        </p>
        <p>
          Our current publisher permissions are unverified. We show titles,
          supplied authors and dates; we omit excerpts and images.
        </p>
        <h2>Editorial publications</h2>
        <ul className="review-sources">
          {enabledSources.map((source) => (
            <li key={source.id}>
              <a
                href={source.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.name} ↗
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <small>Title, author and date · original publication</small>
            </li>
          ))}
        </ul>
        <h2>Cultural discovery</h2>
        <p>
          Wikipedia text is credited to its contributors under CC BY-SA 4.0,
          with the source and revision where available. Article images have
          separate rights: we use Commons images only when their individual
          reusable license is verified, and retain creator, file and license
          links.
        </p>
        <p>
          The Metropolitan Museum of Art images appear only for objects
          confirmed as public domain through its Open Access API. Museum
          attribution, factual metadata and CC0 information accompany each
          object.
        </p>
        <h2>One cultural pick</h2>
        <p>
          Films and series come from TMDB; books and covers from Open Library;
          albums use MusicBrainz metadata. Cover rights belong to their
          respective owners. Album picks have no cover art.
        </p>
        <TmdbCredit />
        <p>
          TMDB is used for this non-commercial portfolio project. Commercial use
          requires a licensing review before monetization.
        </p>
        <p>
          <a
            href="https://openlibrary.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Library ↗
          </a>{" "}
          ·{" "}
          <a
            href="https://musicbrainz.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            MusicBrainz ↗
          </a>
        </p>
        <p>Source and license links accompany every cultural discovery.</p>
      </main>
    </div>
  );
}
