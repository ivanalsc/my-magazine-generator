import type { CulturalItem } from "@/types/editorial";
import type { WikipediaDiscovery } from "@/types/cultural";
export function CulturalAttribution({
  item,
  image = false,
}: {
  item: CulturalItem;
  image?: boolean;
}) {
  const wiki = "pageId" in item ? (item as WikipediaDiscovery) : undefined;
  const media = wiki?.image;
  if (image && !media) return null;
  if (image && media)
    return (
      <p className="license-small cultural-attribution">
        Image: {media.attribution} ·{" "}
        <a
          href={media.originalFileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Wikimedia Commons ↗
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        ·{" "}
        <a href={media.licenseUrl} target="_blank" rel="noopener noreferrer">
          {media.license} ↗
        </a>
      </p>
    );
  return (
    <p className="license-small cultural-attribution">
      {item.attribution}
      {item.source.license && (
        <>
          {" "}
          ·{" "}
          <a
            href={item.source.license.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            License ↗<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </>
      )}
      {wiki?.revisionId && (
        <>
          {" "}
          ·{" "}
          <a
            href={`https://en.wikipedia.org/w/index.php?oldid=${wiki.revisionId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source revision ↗
          </a>
        </>
      )}
    </p>
  );
}
