> Current implementation: Saved and Archive are account-only. Guest Saved persistence and library merge have been removed. Older QA descriptions below are historical; see [Cultural Pick QA](docs/cultural-picks-qa.md) for current behavior and outstanding hosted checks. Apply migrations 001–004 in order for a new database.

# My Magazine Generator

A finite personal magazine: curated publisher links, Wikipedia discoveries and public-domain art, with explicit content permissions, passwordless email accounts and a persistent Archive. Cultural Pick adds factual film/TV/book/album discovery. No AI, Storage or dashboard.

## Run locally

Use **Node.js 22 or newer** (verified with Node 24). Current Supabase SDK versions require it.

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

Open http://localhost:3000. Without Supabase configuration, onboarding, issue generation, cultural exploration work as guests. Saved and Archive require an authenticated account. Accounts display a clear configuration notice. Do not copy placeholder credentials into a running environment.

## Configure Supabase manually

1. Create a Supabase project. Apply migrations 001, 002, 003 and 004 in chronological order; see [pre-deploy checklist](docs/pre-deploy.md). Do not rerun migrations already applied. Hosted status must be verified in the project's migration history/SQL Editor.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` to the project URL and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to its **public publishable key**, from the Connect dialog/API settings. These public values configure the account repository; cultural provider configuration is described below. No service-role key is used anywhere. Never put a service-role or secret key in a `NEXT_PUBLIC_` variable.
3. Auth â†’ URL Configuration: set Site URL to `http://localhost:3000`, then allow `http://localhost:3000/auth/callback`. Add the exact HTTPS production Site URL and callback when deploying. Avoid broad production wildcards.
4. Auth â†’ Providers: enable Email and allow new signups for this prototype. Passwordless email is the sign-in method; Google OAuth is intentionally not configured.
5. Auth â†’ Email Templates: update both **Magic Link** and **Confirm signup** links to:

   ```html
   <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}"
     >Enter your magazine library</a
   >
   ```

   `/auth/callback` verifies the email token hash and redirects to `/account`. It also accepts a PKCE `code` callback. The token-hash template lets the email link work across browsers/devices. Expired links show a request-again message.

6. Configure a suitable SMTP sender before inviting public testers. Supabase's default sender has testing restrictions and rate limits; check the project's current email settings. No Google Cloud setup is necessary for email-only sign-in.
7. Restart `npm run dev` after setting environment variables. Sign in with a fresh email link, generate an issue and verify Saved and Archive survive sign-out/sign-in. Guests have no Saved persistence or library merge prompt.

The implementation follows [Supabase SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) with `@supabase/ssr`, separate browser/server clients, cookie refresh through Next.js 16 `proxy.ts`, and verified `getClaims()` identity. Email setup follows [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Architecture

```
Existing server providers â†’ normalized metadata â†’ explicit content policy
â†’ deterministic MagazineIssue builder â†’ account issue persistence â†’ editorial UI
```

- `types/`: source permissions, editorial/cultural types, preferences, Saved unions and finite issues.
- `data/catalog.ts`: interests and source policies; `lib/sources/registry.ts`: feed connection status. Connectivity verification does not grant reuse rights.
- `lib/sources/`: server-only RSS/Atom, Wikipedia/Commons, Wikimedia historical events and Met adapters. Public-feed URL validation pins safe DNS addresses, rejects private networks and bounds redirects/body/time. Failures remain isolated.
- `lib/content/`: immutable permission definitions and central whitelist preparation. React receives display-ready content and does not decide licensing.
- `lib/repositories/`: account transport/store, Supabase preferences/Saved/issues repository, migration merge rules and issue serialization/reconstruction. Supabase calls stay in this layer and Auth helpers, not throughout components.
- `lib/useMagazinePreferences.ts` and `lib/storage/saved.ts`: shared UI-facing persistence adapters. Guest implementations retain existing localStorage keys; account operations use the repository and surface failures. The same hooks support Today, native exploration, Saved and Archive.
- `components/editorial/`: existing asymmetric newspaper composition, reusable native features and restrained Save controls. `components/account/` and `components/archive/` reuse the typography, rules and paper treatment.
- `app/api/`: authenticated library operations, issue generation and owner-scoped archive retrieval. Account responses are private/no-store. Providers still execute in Next.js, not in Supabase.

## Content policies and attribution

| Source                                               | Explicit policy                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Rolling Stone, Bandcamp Daily, Pitchfork, Stereogum  | External; title, author, date; no excerpts/images/full text                                                                             |
| It's Nice That, Creative Boom, Designboom            | Same conservative publisher policy                                                                                                      |
| Hyperallergic, Smithsonian, The Public Domain Review | Same conservative publisher policy; a publication's name does not establish its article rights                                          |
| Aeon, Nautilus, ArchDaily, Hacker News               | Same conservative publisher policy                                                                                                      |
| Custom RSS/Atom and Substack                         | Same conservative publisher policy, regardless of supplied feed fields                                                                  |
| Wikipedia                                            | Internal; original source intro under CC BY-SA 4.0 with contributor/source/revision attribution                                         |
| Wikimedia Commons images                             | Separate individually verified reusable CC/public-domain license, creator/file/license attribution; never inherited from Wikipedia text |
| The Met                                              | Internal factual metadata and images only for objects independently confirmed public domain/Open Access; museum attribution and CC0     |
| Owned fictional fallback fixtures                    | Original demo titles and separately licensed local Unsplash images; no full publisher text; clearly labeled samples                     |

All real editorial excerpt/image permissions remain **unverified**, so they are disabled. The 13 audited active publisher feeds are Rolling Stone Music, Bandcamp Daily, Pitchfork News, Stereogum, Creative Boom, Designboom, Hyperallergic, Smithsonian, The Public Domain Review, Aeon, Nautilus, ArchDaily and Hacker News RSS. Itâ€™s Nice That remains unavailable. See `docs/source-audit.md` for endpoints, counts and verification results. Selectable but unconnected sources are not silently integrated. `/sources` lists active publishers and explains the cultural attribution rules; the issue footer links to it.

`prepareStoryForDisplay` creates an explicit field whitelist, ignoring untrusted source permission claims during display/persistence. No RSS `content`, `content:encoded` or Atom article body reaches it. Permission filtering applies during normalization, before issue responses, during Saved parsing/mutations, and during persistence/reconstruction. Open snapshots also use a whitelist; account saves reverify open provider identifiers with the existing adapters. Database triggers/RPCs additionally remove external article body/excerpt/image fields. External images stay at their permitted original URLs; no image copies are uploaded.

Publisher headline/image/read links remain direct `_blank` links with `noopener noreferrer` and descriptive accessible labels. Native cultural links use â†’ and source links use â†—. Original source content is never rewritten or AI-summarized.

## Guest and account behavior

Guests need no login. Preferences use `my-magazine-generator:preferences:v1`; their current issue and refreshes remain local. Guests cannot persist Saved; Save and Archive present sign-in invitations.

For authenticated users, Supabase becomes the active library. There is no guest Saved import or merge prompt. Account preferences, Saved and accepted issue revisions persist independently of guest browsing.

Failed account reads show a reconnect notice and disable mutations; they never quietly fall back to guest writes. Failed Save/preferences/issue writes show restrained errors and do not claim success. Account Save writes express a desired saved/unsaved state, so retrying an uncertain write cannot accidentally toggle it back. Library requests have a 30-second timeout. Logout retains local guest data. Account identity participates in issue loading keys to prevent a previous account's issue from remaining visible after sign-out.

## Database and RLS

| Table                  | Purpose and access                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `profiles`             | Minimal owner identity/creation time, owned by Auth user UUID                                             |
| `user_preferences`     | Versioned interest IDs; one row per user                                                                  |
| `user_sources`         | Ordered curated references/custom feed metadata; owner/source composite primary key                       |
| `saved_items`          | Owner/stable-key primary key, explicit item type, permitted snapshot and saved time                       |
| `magazine_issues`      | UUID, owner, per-user number, date, creation time, preference snapshot and immutable layout composition   |
| `magazine_issue_items` | Ordered item records with type, section, source, provider identifier, original URL and permitted snapshot |

RLS is enabled on all six tables. Profiles require `auth.uid() = id`; preferences/sources/Saved require `auth.uid() = user_id` for both reads and writes. Issues are SELECT-only for their owner. Item SELECT requires an owned parent issue. Anonymous roles have no table access. The app uses verified claims and owner-scoped queries as an additional layer, never as a replacement for RLS.

Issue tables grant no direct insert/update/delete to authenticated users. Narrow `SECURITY DEFINER` RPCs have an empty search path, derive the owner exclusively from `auth.uid()`, reject unauthenticated calls and revoke PUBLIC/anonymous execute. Account preference edits and guest merges are atomic. Saved writes receive a database snapshot filter even when issued through REST directly.

## Stable issues and Archive

An authenticated Today request checks the current calendar period first (currently Buenos Aires calendar day). Existing issues load without calling providers. Otherwise providers build a finite issue and the creation RPC acquires a per-user transaction advisory lock, checks again, assigns `max(issue_number)+1` and inserts header/items atomically. Unique `(user_id, issue_date)` and `(user_id, issue_number)` constraints prevent duplicate periods/numbers. Concurrent requests may perform duplicate provider work, but only one composition is persisted; both receive that persisted issue.

Visible numbers are `001`, `002`, etc., independently for each user; URLs use stable UUIDs `/issue/[id]`. Archive reconstructs snapshots, sections and historical items in saved order. It never regenerates editorial composition; TMDB identity references hydrate current metadata through a bounded cache. The preference snapshot explains what shaped that issue. Archived composition is immutable while Save status remains mutable. Native exploration keeps stable Wikipedia page/Met object identifiers; the linked native detail page can show a newer provider revision, while the archived magazine snapshot stays unchanged.

Archive uses a typographic shelf with an emphasized latest issue and smaller past issues, paired on mobile. Guests see the account benefit with a sign-in link. There is no infinite scroll or SaaS table.

## Accessibility and validation

Semantic articles/heading hierarchy, source captions, meaningful available alt text, accessible Save pressed states, keyboard-visible focus, secure/descriptive external links and reduced-motion support remain in place. Auth uses a labeled email input, native buttons, disabled pending actions and live success/error messages. Archive preserves editorial scale and horizontal rules at desktop, 390px and 320px.

`npm test` covers provider normalization and licensing, conservative permissions, legacy guest Saved, authenticated owner-scoped Saved/failures, guest merge rules, stable snapshot reconstruction and the **actual SQL migration** in embedded PostgreSQL (PGlite, development-only). Database tests exercise two owners, anonymous denial, immutable issue tables, idempotent imports, publisher snapshot guards and per-user issue numbering/repeated daily creation. Production multi-connection locking and hosted Auth email delivery still need verification against the configured Supabase project.

The account entry now lives at `/sign-in`; `/account` redirects guests there and serves the signed-in library. The root server layout seeds verified session identity before rendering the header, while the existing account repository loads library data. Confirmation masks the email and moves focus to the heading. Guest preferences remain device-local; Saved and Archive explain the account benefit. Logout clears visible account state immediately and preserves guest storage.

Configured Supabase validation confirmed enabled email signup, an accepted real passwordless email request (HTTP 200), and denial of anonymous reads against the deployed private library tables. Public configuration belongs in ignored `.env.local`, with the project origin as URL (no `/rest/v1` suffix). Tests, lint and the production build pass. Callback authentication, hosted merge/persistence, returning sign-in and two-account hosted isolation still require the delivered email link; email request acceptance alone does not prove delivery or an authenticated session. Embedded PostgreSQL tests independently exercise RLS and transactional persistence. Verify callback allowlisting and the email template in the dashboard when completing that live flow.

## Deliberate limits

Email magic links only; no password or recovery forms, Google provider, new content providers, authentication requirement, AI, database feed fetching or Storage. Existing accounts, guest data and library persistence remain intact. Email requests are subject to Supabase sending limits; the UI explains throttling and does not claim delivery merely because the request was accepted.

## Final curation iteration

The deterministic editorial desk fills at most ten relevant stories plus one outside discovery. It first gives less-represented selected categories space, then prefers canonical identifiers absent from recent issues, then publishers used fewer times, then supplied publication dates and stable seeded ties. Candidate-pool size grants no extra weight. Custom publications have their own feed identity and follow the same balance rules. There is no Saved signal, semantic similarity, AI or hard diversity failure; repeated/restricted-source selections remain possible when alternatives are scarce. The current onboarding still requires three interests; the builder itself has focused one-interest and all-interest fixtures.

For a new authenticated issue, `recent_magazine_items` returns only URL/page/object identifiers from the five previous final issues. Without the new migration, a bounded base-item query retains initial issue generation/history compatibility. Existing current issues are returned before providers/history are fetched. RSS pools retain 30-minute caching; Wikipedia topic pools and Met search/object caches retain their existing lifetimes. A refresh requests only relevant editorial feeds or the affected cultural provider, never On This Day. Cultural validation can try bounded repeated candidates if fresh ones fail qualification.

Apply `supabase/migrations/202610060002_issue_revisions.sql` after the original migration. It adds one append-only table and two narrow owner-scoped RPCs. Base issues/items are never updated. A refresh appends a complete permitted composition linked to its base issue; expected revision checks reject stale tab writes, unchanged entries/section metadata are checked transactionally, and only the current Buenos Aires issue date can be revised. Both Today and `/issue/[id]` read the latest accepted revision. Past periods cannot change; all earlier snapshots remain retained. The UI exposes no version numbers. Revision entries run through the existing database snapshot filter. RLS denies anonymous reads and prevents another owner from reading or revising the issue. No direct client INSERT/UPDATE/DELETE grant is added.

Refresh controls appear at the end of external groups, Rabbit Hole and Artwork. Lead and On This Day remain fixed; Outside Your Bubble stays fixed in this V1 UI. Requests preserve current content, disable controls while pending, use a two-second click guard and announce completion/failure. A too-small alternative pool leaves the entire section unchanged. The database bounds accepted revisions to 100 per current issue and rejects writes within two seconds of the last accepted revision. Guests retain one accepted current issue in localStorage; date/preference changes invalidate it. Guests do not acquire persistent Archive or cross-issue history. If the revision table is not deployed, authenticated original issues still load and refresh controls are withheld.

Tests cover source/category balance, custom-source parity, canonical recent identifiers and graceful repeats, one/three/all-interest fixtures, deterministic replacement/current exclusions, cultural rights and replacement identity, guest serialization, source gating, and real PostgreSQL revision/RLS/immutable base/final snapshot history. Provider failure and no-alternative UI checks preserve existing content. Real hosted authenticated refresh remains a manual QA step after applying the migration and establishing a session; the email limit previously prevented that session. This iteration does not change passwordless authentication.

## Product polish QA

See [the QA report](docs/product-polish-qa.md) for artwork identity, source rack cleanup, bounded current-issue refresh history, real profile results, coverage gaps and outstanding authenticated manual checks. Custom RSS infrastructure remains internal; existing records survive editing and optional-source skipping.

## Cultural Pick configuration

See [the implementation and QA report](docs/cultural-picks-qa.md). Configure `TMDB_READ_ACCESS_TOKEN` server-side for film/TV and `CULTURAL_API_CONTACT` with a technical contact for identified Open Library/MusicBrainz requests. Never prefix these with `NEXT_PUBLIC_`. MusicBrainz requires the shared reservation RPC in migration 003. Apply additive migration 004 for TMDB reference-only persistence. Provider metadata caches revalidate every 24 hours; albums never request covers. This prototype is noncommercial; review TMDB licensing before monetization.

On Windows installations where Turbopack subprocesses fail with EPERM, validate production using `next build --webpack` with Node 22+; the standard build command remains unchanged.

The [Cultural Pick correction report](docs/cultural-pick-correction-qa.md) documents English-edition filtering, media-type balancing and the media-specific visual compositions.
