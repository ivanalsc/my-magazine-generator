/* eslint-disable @next/next/no-img-element -- Unmodified approved TMDB logo hosted by TMDB. */
export function TmdbCredit() {
  return (
    <div className="tmdb-credit">
      <a
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          className="tmdb-logo"
          width="110"
          height="79"
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
          alt="The Movie Database (TMDB)"
        />
      </a>
      <p>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
