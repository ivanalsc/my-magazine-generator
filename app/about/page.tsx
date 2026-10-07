import { MagazineHeader } from "@/components/editorial/Magazine";
import { stories, culturalItems } from "@/data/mock/issue";
export default function AboutPage() {
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail">
        <p className="eyebrow">About the magazine</p>
        <h1>Curated, never rewritten.</h1>
        <p>
          My Magazine Generator is a personalized magazine made from the things
          you’re curious about.
        </p>
        <h2>Your publications, their content</h2>
        <p>
          Connected RSS publications provide original headlines and optional
          author/date metadata. Unverified excerpt and image permissions remain
          disabled. Stories open directly at the publisher. We never rewrite,
          summarize or reproduce their full articles.
        </p>
        <p>
          Saved keeps permitted metadata, so a story remains in your collection
          after the current issue changes. The magazine is open; Saved and
          Archive require an account. Guests keep their choices and current
          issue locally; signed-in users keep preferences, Saved and immutable
          issues in their account. Archive opens the latest accepted selection.
        </p>
        <h2>Open discoveries</h2>
        <p>
          Cultural discoveries come from Wikipedia, Wikimedia’s On This Day feed
          and The Metropolitan Museum of Art Collection API. Introductions
          remain source text with contributor and license credit. Wikimedia
          Commons images require verified reusable licenses and attribution. Met
          objects are checked individually for public-domain status.
        </p>
        {process.env.NODE_ENV === "development" && (
          <p>
            If connected feeds cannot fill your interests, the issue labels its
            sample selection. Those fictional editorial fixtures retain
            fictional publication names and example.com demonstration links. No
            invented story is attributed to a real publisher.
          </p>
        )}
        <h2>Sources & image credits</h2>
        {culturalItems.map((item) => (
          <p key={item.id}>
            <a
              href={item.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.title} ↗
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <br />
            <span className="license-small">{item.attribution}</span>
          </p>
        ))}
        {(process.env.NODE_ENV === "development" ? stories : [])
          .filter((article) => article.image)
          .map((article) => (
            <p className="license-small" key={article.id}>
              {article.title}:{" "}
              <a
                href={article.image!.creditUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {article.image!.credit} ↗
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              · {article.image!.license}
            </p>
          ))}
      </main>
    </div>
  );
}
