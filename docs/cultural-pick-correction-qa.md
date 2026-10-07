# Cultural Pick quality and presentation correction

7 October 2026. Correction only; no new provider, feature, migration or account behavior.

## Visual changes

Cultural Pick now forms a distinct magazine interruption, with its own folio, strong rules, more space and an italic experiential kicker. Book: pale green paper field, prominent uncropped cover, title/author/year and restrained subjects. Film/TV: near-black editorial field, warm paper typography, prominent poster opposite the title on desktop. Album: paper background, oversized serif title, artist and year, no image or placeholder. Missing book covers collapse to a deliberate typographic composition.

“FOR YOUR NIGHTSTAND”, “TONIGHT’S PICK” and “LISTEN TO THIS” provide recognizable media cues. Explore and Another pick share an action row inside the composition; refresh failure preserves the current pick. Detail pages reuse the composition without a refresh action.

## Open Library language filtering

Both discovery and Work lookup request `language:eng`, `lang=en` and explicit English-edition fields. `lang=en` alone was insufficient: it expresses a preference, not an exclusion. An explicitly English-labelled edition supplies the display title (and its cover where available). A Work title is accepted directly only when its declared language is English alone. Multilingual Work titles without a reliable English display edition are excluded. A Latin-script readability guard also rejects inaccessible fallback titles; it is not an AI language detector. International authors and translated Works retain their Work identity and provider-supplied author credits. No title is inferred, translated or generated.

A real Open Library literature query returned 12 records; 11 passed the language/creator/title checks. Tests include a Russian Work whose English edition is *Crime and Punishment*, and the reported Chinese title with no readable English display edition. The language rules follow [Open Library Search API documentation](https://openlibrary.org/dev/docs/api/search).

## TMDB localization

Discover and detail requests retain `language=en-US`. Display uses localized `title` / `name`; original language is never an eligibility filter. Korean and Japanese fixtures remain eligible with provider-supplied English display titles and directors. An inaccessible untranslated fallback is excluded from new discovery. Original titles are not added as extra UI metadata. TMDB's token remains absent, so this correction does not claim live TMDB verification. See [TMDB language documentation](https://developer.themoviedb.org/docs/languages).

## Candidate quality

Discovery checks are separate from persisted snapshot validity, preserving existing Saved/Archive records. New candidates require meaningful title and creator metadata. Blank, numeric-only, placeholder, control-character, oversized and obvious reissue/deluxe/anniversary title noise are excluded; book records require an actual Work identity. Missing cover/year remains acceptable. TMDB discover results are hydrated before creator validation, because discover does not include director/creator credits. Bad detail requests no longer suppress subsequent candidates. Stable IDs deduplicate each type's pool. Albums continue to require actual Album release groups and existing secondary-type exclusions, with no cover requests.

These are conservative metadata filters, not a claim of human editorial review. No popularity-only ranking or English-origin restriction was introduced.

## Media-type balancing

1. Compute eligible formats from the existing interest mappings before requesting a provider pool.
2. Group film and TV as one screen category, so two TMDB formats do not gain double selection weight.
3. Deterministically order categories by avoiding the currently displayed category, then by lower representation in recent Cultural Pick identities, direct interest affinity, mapped interest affinity, and a date/interests/refresh-counter seed for ties.
4. Choose a subtype within a category, then select a distinct candidate from that type's pool. Pool size never enters type ordering.
5. If a type has no usable candidate or fails, try the next type. Recent identities are soft preferences; current identities remain hard exclusions.

This encourages Book → Screen → Album variety when all three are eligible and healthy, without a rigid rotation. Existing bounded previous-issue/revision identity history supplies the type information; no Archive schema or persistence behavior was changed. Type history is identity-based and bounded, rather than an exact lifetime frequency counter.

## Another Pick

The same type-first ordering applies to refresh. Current category avoidance gives a healthy alternative medium priority; a different valid identity is always required. Unit fixtures verify three-format variety and availability fallback. A browser test verifies Book → Film, atomic replacement of the displayed identity/composition, persisted guest revision, and reload restoration.

A live mixed-interest issue returned an English-labelled Open Library book. Live MusicBrainz audit returned HTTP 503; with TMDB absent, refresh used another book. This is availability fallback, not evidence that healthy formats are ignored. Cross-provider variety is verified with controlled healthy-provider fixtures, not claimed as live under those failures.

## Responsive and regression QA

Browser checks passed at 1440, 390 and 320px for book with cover, book without cover, film, TV, album, very long title, five long creator credits, available year, missing year and absent pick. No horizontal overflow or browser errors. Explore/Another pick appear inside every active composition. Album and coverless book render no image placeholder. Controlled cover/poster images exercise layout; they are QA fixtures, never product assets. Screenshots reviewed for desktop film, mobile book, narrow album and coverless book.

Guest Save invitation, no guest Saved persistence, no merge UI, account-only library invitations and reload behavior remain verified. Artwork, Rabbit Hole, editorial composition, rights policy, authentication, Saved architecture, Archive persistence and issue ending were not intentionally changed. Prior regression coverage remains in the full suite.

## Quality gates

- Full suite: 63 tests pass, including all prior 46 regressions and 8 new focused quality/balance tests.
- ESLint: passes with no warnings.
- TypeScript: passes.
- Production build: passes with Next.js Webpack, including all routes. Webpack is the existing Windows fallback for the earlier Turbopack subprocess permission failure; the package build command was not changed.
- No database migration is required for this correction.

Implementation stops here. Live TMDB remains dependent on its server-only credential; healthy live multi-provider variety can be revisited when MusicBrainz is available. This correction does not alter the previously pending real-account acceptance work.
