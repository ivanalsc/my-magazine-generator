# Cultural Pick reliability correction

Verified October 7, 2026. Reliability changes only; no visual or eligibility changes.

## MusicBrainz

Search results legitimately omit `secondary-types` for primary Album records. The previous adapter required an array, rejecting every record in the observed 30-result response. Search normalization now treats genuine omission as an empty array only for Album. Detail normalization still requires an explicit array. Present malformed values and excluded primary/secondary classifications remain rejected.

Live diagnostic query: 30 records received; old normalization accepted **0**, corrected search normalization accepted **29**. Existing title/creator/discovery checks still apply. Equivalent search and detail records normalize identically apart from retrieval timestamps. The pool cache key advances to v4 so previously cached empty results do not mask the correction.

## Open Library

The existing seeded interest ordering produces **travel → design → art** for Art & Culture, Design, Music and Travel. Subjects are deduplicated and capped at **three attempts**. Requests run sequentially. A request exception or zero usable normalized candidates advances to the next subject; the first usable pool stops further requests. Existing English-language evidence, quality rules, timeouts and request spacing remain in effect.

Subject pools have a shared 24-hour cache, in addition to the existing pool cache. No eager parallel subject search was introduced.

Development-only diagnostics distinguish subject timeout, HTTP status/class (including 5xx), invalid response, normalized-empty and success/count. They contain only controlled subjects and classified failure reasons, never arbitrary error messages, URLs, provider payloads or account data. Cached pools need not emit fresh request diagnostics. No diagnostic UI was added.

## Reproduction and failure QA

- New guest issue, no relevant history, interests `art/design/music/travel`: eligible order remains **Album → Film → Book**. Live MusicBrainz yielded 29 normalized candidates; Album selected; HTTP **200**, issue present, no cultural failures. No later type was needed.
- A separate live MusicBrainz diagnostic request returned **503**, confirming transient provider failure remains possible; a subsequent identical query succeeded.
- Controlled regression: MusicBrainz 503 → TMDB unavailable → Open Library Travel timeout → Design success: **Book produced**. Exact attempt order asserted.
- Empty/invalid first subject and thrown first subject both advance to the second; a successful second subject stops the sequence.
- Three failed/empty subjects exhaust the bound and return no pool. Cross-type fallback remains unchanged.
- Isolated production HTTP QA intercepted every MusicBrainz/Open Library/TMDB upstream request with HTTP 503 and left TMDB credentials absent: issue endpoint returned **200**, issue present, **zero Cultural Picks**. Test interception exists only in ignored QA scripts, not application code.

TMDB credentials are currently absent. Missing credentials safely skip Film and continue fallback. Live Film/TV QA requires configuring server-only `TMDB_READ_ACCESS_TOKEN`; no alternative API or fabricated result was used.

Existing persisted issues are not backfilled or mutated. The adapter/cache changes apply to new generations and existing eligible refresh behavior. Archive immutability, balancing, Another Pick UX, rights, Saved, auth and editorial modules are unchanged. Scope hashes confirmed unchanged mapping, stylesheet, Cultural Pick/issue components and generation/refresh routes.

## Verification

- **73/73 tests passed**, including ten new reliability regressions.
- ESLint: passed with no errors.
- Production build: passed with `next build --webpack`, including TypeScript and all 23 static pages. Existing package scripts were not changed.
