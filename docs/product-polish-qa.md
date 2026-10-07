# Product polish / QA — 7 October 2026

## 1–2. Artwork root cause and correction
The accepted replacement already carried its own complete Met payload through normalization, replacement, serialization and reconstruction. Remote cultural images use a direct browser `<img>`, not Next image optimization. The previous implementation reused that DOM image when `src` changed: a browser can keep the previous decoded image visible while loading the next resource. `EditorialPhoto` also retained its failed state across resources. ArtworkFeature now remounts by stable `met:<objectId>` identity; PhotoResource remounts by image URL. Metadata, attribution, links and SaveButton change in the same React commit; previous pixels cannot survive that commit. The new image may be blank briefly while loading. No forced reload, cache busting, disabled caching or publisher images were introduced.

A second previously unguarded case was different Met records sharing an image URL. This is a possible selection failure, not a confirmed provider incident in this run. Met candidate validation now skips the current image URL and the replacement boundary rejects unchanged/missing artwork images. Object and final-selection caches retain their existing lifetimes and include selection arguments in cache identity.

## 3–4. Persistence and Saved
Live guest refresh changed the artwork and retained the accepted issue after reload. A controlled delayed-image browser test verified the new src/identity with no old currentSrc, then image load, independent saving of A and B, B unsaved initially, and B still saved after reload. Unit tests cover changed object/image/title/artist/year/medium/department/museum link/attribution/license together through guest parsing and Archive reconstruction. Actual PostgreSQL migration tests exercise owner-authenticated artwork revision persistence and owner isolation. Original immutable rows remain intact.

A real authenticated browser session has NOT been established. Hosted Archive and sign-out/sign-in persistence still need one successful magic-link session and confirmation that migration 202610060002_issue_revisions.sql is applied. Guest Archive retains its existing account-required behavior; there is no new guest archive feature.

## 5–9. Sources cleanup and compatibility
The custom URL form, add/remove controls and source validation request handler were removed from normal UI. Safe RSS parsing, validation, API and tests remain reusable. Existing custom records remain readable and are retained when editing or skipping optional publications; this avoids silently deleting data the UI no longer exposes. Existing records can continue contributing to issues. There is no normal product entry point for creating new custom sources.

The optional rack now contains only 13 active editorial publications. It's Nice That is excluded; its unavailable audit entry remains internal. Feed connected / Not connected yet are gone. Supporting copy: “Choose a few publications, or let us find interesting things for you.” Selected count describes the visible curated choices. None/Skip still creates an interest-based issue for a new user.

Wikipedia and The Met are not selectable publications. A small static “Cultural discovery · Included in your magazine” area explains them. Both providers remain requested independently of publication choices; unavailable native results are omitted safely. Legacy provider selections are cleaned from the editable rack without deleting custom records. No new sources or auth methods were added.

## 10–11. Interest coverage matrix
Counts are normalized live candidate snapshots from this QA run, before personalized selection. They reflect source categories, not proof that every article matches that topic. Two Wikipedia seed terms exist per interest; only one Rabbit Hole and one artwork appear in an issue. All museum results still require public-domain eligibility. Met search relevance is broad and can fall back to painting.

| Interest | Active editorial publishers / candidate depth | Wikipedia / Met topic support | Outside bubble | Coverage |
|---|---|---|---|---|
| Art & Culture | Creative Boom, Hyperallergic, Smithsonian, Public Domain Review / ~105 | Art movements, visual arts / painting, landscape | Yes | STRONG |
| Design | Creative Boom, Designboom, ArchDaily / ~54 | Design movements, typography / textiles, ceramics | Yes | STRONG |
| Creativity | Creative Boom / ~20 | Creativity, art techniques / drawing | Yes | ADEQUATE |
| Music | Rolling Stone, Bandcamp Daily, Pitchfork, Stereogum / ~117 | Genres, musical techniques / instruments | Yes | STRONG |
| Books & Literature | Public Domain Review / ~60 mixed art/history/book entries | Literary movements, history of books / manuscripts | Yes | ADEQUATE |
| Science | Smithsonian, Aeon, Nautilus / ~40 broad entries | Natural phenomena, scientific theories / no dedicated Met seed | Yes | ADEQUATE |
| Technology | Hacker News / ~30, additional exact RSS tags possible | Technology history, emerging technologies / no dedicated Met seed | Yes | STRONG |
| Architecture | Designboom, ArchDaily / ~34 | Architectural styles, vernacular architecture / architecture, interiors | Yes | STRONG |
| Travel | Smithsonian / ~10 broad entries, weak topic specificity | Cultural landscapes, trade routes / landscapes, maps | Nominally yes | WEAK |
| History | Smithsonian, Public Domain Review / ~70 mixed entries | Civilizations, historical eras / antiquity, portraits | Yes | ADEQUATE |
| Psychology | Aeon / ~20 broad philosophy/science/video entries | Cognitive psychology, psychological phenomena / no dedicated Met seed | Yes, broad | ADEQUATE |
| Ideas | Aeon, Nautilus / ~30 | Philosophical concepts, schools of thought / no dedicated Met seed | Yes | STRONG |
| Photography | No dedicated active publication / 0 guaranteed | Photographic processes, photography history / photographs | Exact supplied RSS tags only | WEAK |
| Film | No dedicated active publication / 0 guaranteed | Film genres, cinematic techniques / no dedicated Met seed | Exact supplied RSS tags only | WEAK |
| Food | No dedicated active publication / 0 guaranteed | Food culture, fermentation / still life | Exact supplied RSS tags only | WEAK |
| Nature | Smithsonian, Nautilus / ~20 broad entries | Ecological succession, natural phenomena / flowers, landscapes | Yes, broad | ADEQUATE |

The RSS normalizer unions publication-wide categories with recognized exact feed tags. Consequently, a Smithsonian science story can be counted as Travel/History. This is a known semantic limitation, not successful article-level personalization. No inferred tags or generated editorial text were added to disguise it. Recommendation before deployment: review Travel as a separate editorial promise; merge/hide Photography, Film and Food as standalone issue interests unless their cultural-only role is clearly intentional. Such a taxonomy change is material and was not made automatically. Better article-level mapping from reliable publisher taxonomy is a separate review decision, not silently implemented here.

## 12–15. Real profile QA
All four requests returned 200, 11 external stories, real data and no fictional editorial fallback. Identical date/preferences/candidate pools remain deterministic; fixtures test this without adding a profile product feature.

| Profile | Available candidates | Accepted editorial composition | Native result / relevance |
|---|---:|---|---|
| Travel + Food + Psychology + Film | 40 incl. outside source | Lead Aeon; Travel 5, Psychology 4; outside Rolling Stone | Heath + Gathering of government officials. Weak: no Food/Film sections; several Travel stories actually science; landscape discovery is only loosely travel-related; artwork not demonstrably tailored. This profile does NOT satisfy the complete personalization promise. |
| Creative | 179 | Art 3, Design 3, Architecture 2, Ideas 1 + lead/outside; 8 publications represented overall | All caps + [Woman Seen from the Back]. Typography relevant; strong art/design variety; Photography has no dedicated section. |
| Culture | 207 | History 3, Books 3, Music 3 + lead/outside; 7 publications overall | The Hours of Jeanne d’Evreux, Queen of France; Wikipedia unavailable in this request and omitted. Manuscript fits books/history; Film absent; Smithsonian History labels include science mismatches. |
| Tech Curious | 134 | Design 2, Science 2, Ideas 2, Psychology 2, Technology 1 + lead/outside; 7 publications overall | Safavid Courtiers Leading Georgian Captives; Wikipedia unavailable and omitted. Stronger editorial variety, broad psychology labels and weak artwork relevance remain. |

Provider failures did not erase other discoveries. Cultural licensing is verified independently of topic relevance. Do not interpret museum reuse eligibility as evidence of personalization.

## 16–17. Headline and sparse composition
Text-only leads use more available width with fluid 36–76px type, 1.06 line height and a 22ch headline measure. Full wrapping is retained, including long words; no normal editorial headline is truncated. Browser fixtures at approximately 20/50/100/160/230 characters pass desktop/mobile overflow checks. Single-story sections use one real column with an intentional 920px reading measure. Two stories use a 1.25:1 split on desktop, deliberate single flow on mobile; three or more retain the asymmetric grid. Empty groups are omitted by existing builder/view rules. No filler, excerpt or publisher image was invented.

## 18. Repeated refresh
Previously, exclusions covered current items and previous daily issues but forgot earlier accepted selections from today. Guest accepted envelopes now keep up to 300 prior identities, sanitized and persisted locally. Accounts derive trusted history from immutable owner-bound revision rows (at most 30 revisions, retained identities capped at 300), ignoring client history. This is a soft preference; current items stay hard-excluded and exhausted pools may reuse older valid choices. Live repeated refresh produced three distinct music selections, Wikipedia page IDs 32538 → 51320 → 4620 and Met object IDs 548338 → 248268 → 22860. Existing interest/publication balancing is preserved. Met additionally excludes the current artwork image URL. No schema or rights change was necessary.

## 19. Visual and interaction QA
Captured and reviewed Interests, Sources, issue, Saved, guest Archive and guest Account at 1440/390/320; navigation additionally checked at 1920. No horizontal overflow or browser exceptions. The default masthead date on library screens was also corrected from the fixed October 6 demo date to the current Buenos Aires edition date. Interests keep readable two-column mobile choices, visible selected marks, minimum-three copy and reachable Continue. Sources have clear selected/optional/skip/generate actions; at narrow widths long names receive larger column space rather than character-by-character wrapping. Real headlines, Rabbit Hole, licensed artwork and finite ending retain the editorial identity. A controlled delayed-image fixture is separate from real-content screenshots; the white test pixel is not product content.

Personalization copy now says “Made from your choices”. Existing sparse section context and quiet refresh controls remain. The finite ending remains final; no recommendation feed follows it.

## 20. Verification
46 tests passed; ESLint passed; Next.js 16.3.8 production build passed. Focused regression coverage includes guest/native atomic payload, distinct Saved keys, Archive reconstruction, owner-authenticated PostgreSQL artwork revision, duplicate image refusal, publication exclusions, low-coverage/profile fixtures and non-repetition. Existing rights, SSRF, RLS, immutable issue and auth tests remain.

## 21. Remaining manual review / stop
Establish a real authenticated session, verify hosted revision migration, refresh and save artwork, open its Archive entry, sign out/back in and confirm the same image/metadata. Review the weak interest taxonomy and publisher-wide classification before claiming reliable personalization. Museum relevance and occasional Wikipedia provider failures deserve final product QA. No deployment or subsequent feature work was started.
