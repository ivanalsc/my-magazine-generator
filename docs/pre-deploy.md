# Final pre-deploy checklist

October 7, 2026. No deployment performed.

**BLOCKED BY:** completing real magic-link/account persistence QA, verifying the hosted database is at migration 004, and configuring the production Auth URLs when the Vercel URL exists.

## Changes

- Onboarding and its edit form expose 14 interests: Art & Culture, Design, Creativity, Music, Books & Literature, Science, Technology, Architecture, History, Psychology, Ideas, Photography, Film and Nature.
- Travel/Food remain in the internal catalog, parsers and provider mappings. Existing selected values remain in form state and persisted preferences; nothing automatically rewrites them. A production issue request containing `travel/food/art` returned HTTP 200 with all three interests intact.
- Fictional editorial fallback is restricted to development. Production issue generation uses actual provider stories and graceful sparse/empty sections. Existing snapshot preparation remains compatible with historical sample issues.
- About no longer labels the product with development-only prototype copy or displays fictional story image credits in production. Sources no longer advertises fictional fallback.
- README no longer instructs users to merge guest Saved. Its optional token-hash template uses `&amp;token_hash=` because the application always includes `?next=` in `emailRedirectTo`.
- No migration, provider mapping, visual layout, auth implementation or selection algorithm was changed.

## Supabase migrations — apply once, in this order

| File | Purpose | Hosted verification |
| --- | --- | --- |
| `202610060001_library.sql` | Profiles, preferences/sources, Saved, immutable issues/items, RLS, snapshot guards and owner-scoped RPCs | Anonymous probes confirm library tables deny access; complete migration history not independently verified |
| `202610060002_issue_revisions.sql` | Accepted issue revisions, owner-only history and refresh transaction | Previously user-confirmed; not independently verified in hosted migration history this run |
| `202610070003_cultural_picks.sql` | Film/TV/Book/Album Saved and issue types, snapshot validation, updated revisions, shared MusicBrainz limiter, revokes guest library merge | Introduced by Cultural Pick/Saved work. Previously user-confirmed; live MusicBrainz requests used the limiter successfully, but the entire migration/history is not independently verified |
| `202610070004_tmdb_references.sql` | Persist TMDB identity/reference only; hydrate metadata/poster through bounded cache rather than store indefinitely | Introduced by Cultural Pick/Saved retention work. Hosted application is **unverified**; verify/apply before deployment |

Files are under `supabase/migrations/`. No later migrations exist. Do not rerun 001–003 blindly or edit any existing migration. Use hosted migration history, or inspect SQL Editor state if migrations were applied manually. No management/database credentials are available to this QA session.

Read-only SQL Editor checks can supplement (not replace) migration history:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'user_preferences', 'user_sources',
    'saved_items', 'magazine_issues', 'magazine_issue_items',
    'magazine_issue_revisions', 'cultural_provider_limits');

select pg_get_functiondef('public.clean_snapshot(jsonb,text)'::regprocedure)
  like '%pointerOnly%' as tmdb_reference_cleanup_present;

select not has_function_privilege('authenticated',
  'public.merge_guest_library(jsonb,jsonb)', 'EXECUTE')
  as guest_saved_merge_disabled;
```

## Real authenticated QA

Hosted Auth settings returned HTTP 200: Email enabled, new signup enabled. Anonymous library table reads returned 401/permission denied with zero visible rows. These checks verify reachability/privacy, not successful sign-in or account writes.

The current browser is signed out; the old private QA storage also yields no authenticated account. A fresh sign-in is required. A question for completing that sign-in is pending; no email was sent without the requested response. No authenticated QA step below is claimed as passed:

| Required live check | Status |
| --- | --- |
| Request/deliver/open fresh magic link; verified hosted account session | Pending |
| Generate/read authenticated issue | Pending |
| Save external article | Pending |
| Save Wikipedia discovery | Pending |
| Save Artwork | Pending |
| Save Cultural Pick (include TMDB-backed item after 004) | Pending |
| Refresh Artwork | Pending |
| Another Pick | Pending |
| Reload; Saved and accepted issue/revision persist | Pending |
| Archive list persists; open archived issue | Pending |
| Sign out | Pending |
| Sign back in with a fresh magic link | Pending |
| Saved and Archive still present | Pending |

Use a real account, preserve existing saved entries and immutable issues, and do not replace a stored daily issue merely to test generation. Existing today's issue may be reused by the account route. Check the latest accepted revisions rather than mutate archived compositions. Source/network failures must remain visible as retriable failures rather than pretend saves succeeded.

## Guest QA

An isolated browser against the local production build verified the 14-interest selector, onboarding/generation, successful Artwork refresh and Another Pick responses, reload, Explore, Save's editorial sign-in invitation, Saved/Archive sign-in invitations, no guest Saved localStorage, no merge prompt and zero uncaught page errors. Production accepted legacy Travel/Food preferences, returned no fictional stories and did not expose `?debug=1` diagnostics. Consecutive refresh QA respected the existing two-second interaction guard.

The current code keeps guest preferences/current accepted issue locally; Saved is exclusively account-backed. Guest Save never writes or merges a local library. API account mutations and Archive reads require a verified hosted session.

## Deployment environment

| Variable | Classification | Requirement |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Safe public variable | Required hosted project URL; available at build and runtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Safe public variable | Required public publishable key (or public anon key); never service-role/secret key |
| `TMDB_READ_ACCESS_TOKEN` | Required server secret | Required for live Film/TV; missing token gracefully makes TMDB unavailable |
| `CULTURAL_API_CONTACT` | Required server configuration, **not a secret** | Public contact email or website in provider User-Agent; required by current cultural request adapter; keep server-side |
| `NODE_ENV` | Framework-managed | Next/Vercel set production; no custom secret or manual override required |
| `PORT` | Local/process-only | Used by local start tooling; Vercel manages listening, no deployment value needed |

These are the only environment reads in current application code. `.env.local` is local-only and ignored; configure the four application variables in Vercel's Production environment (and separately Preview if used). All four are currently present locally; production values are not assumed configured. Use Node 24 (Node 22+ required by current Supabase SDK). Production build verified with `next build --webpack`; Vercel can use `npm run build -- --webpack` to match the verified command.

No Supabase service-role key, database password, AI key, OAuth secret or separate Wikipedia/Met/Open Library/MusicBrainz API key is required by this code. SMTP credentials belong in hosted Supabase Auth's mail settings, not in `NEXT_PUBLIC_*` or this app's env. Verify email delivery/sender restrictions before public use.

## Supabase production Auth URLs

Once the final URL is known, replace `<production-host>` with the exact canonical Vercel host/custom domain:

- Recommended **Site URL**: `https://<production-host>`.
- Add production redirect/callback: `https://<production-host>/auth/callback`.
- Retain development redirect/callback: `http://localhost:3000/auth/callback`.
- If developing explicitly with `127.0.0.1`, also retain `http://127.0.0.1:3000/auth/callback` as a separate origin.

Actual route: `app/auth/callback/route.ts`. The browser builds `emailRedirectTo` from `location.origin` plus `/auth/callback?next=...`; callback accepts PKCE `code` or email `token_hash`. It redirects to allowed local destinations and otherwise `/account`. No app-wide public base-URL env variable is required. Keep localhost entries; production should use the stable canonical origin. Add individual preview origins only if they need real Auth QA; do not add broad production redirect wildcards. See [Supabase redirect configuration guidance](https://supabase.com/docs/guides/auth/redirect-urls).

For the documented optional cross-device token-hash email template, both Magic Link and Confirm signup links must append `&amp;token_hash={{ .TokenHash }}` to `{{ .RedirectTo }}`, since `RedirectTo` already has its `next` query. Existing PKCE/default email flows remain supported. Hosted URL/template settings have not been modified or independently inspected.

## Cleanup and verification

- Application console diagnostics are development-gated and sanitized. Production opt-in debug output is absent, confirmed by HTTP QA.
- Ignored `qa/` contains historical fixtures/browser state and diagnostics; excluded from version control and unrelated to app routes. `.env*` and build output are ignored. Only placeholder `.env.example` is included.
- No hardcoded localhost deployment origin or test-account email is present in application code. Auth uses the current origin. The source URL normalizer's localhost allowance is subsequently rejected by network safety rules.
- Date of new issues is generated in Buenos Aires time; fixed 2026 dates remain in historical fixtures/audit notes, not today's production issue generation.
- Production no longer adds mock editorial stories. Legacy `/discover` and snapshot preparation retain old cultural fixtures so historical data does not break; those are not newly generated provider picks.
- Public Supabase key was verified as a public role. TMDB secret was not found in client assets. Secret values were never printed. No test credentials or release-blocking TODO/FIXME were found in application code.
- Live source failures observed during dev revalidation included provider timeout/network failures; existing isolation preserves issue generation. It's Nice That's previously broken feed remains disabled. No source URLs were rewritten merely because of transient/bot-related errors; this is not a guarantee that every third-party article URL remains reachable forever.
- **73/73 tests passed**, including local PostgreSQL RLS/snapshot/revision regressions; they do not substitute for hosted authenticated QA.
- **Lint passed** with no errors.
- **Production build passed** with Webpack, including TypeScript and 23 static pages.
- The local production server also logged a destination-stream-closed error around browser QA/teardown. Guest HTTP/UI checks completed and the browser recorded zero uncaught page errors; no account-flow or deployed-runtime success is inferred from those checks.

Remaining manual gates: verify/apply hosted migration 004 and finish real magic-link/account QA, then set the exact production Auth origin/callback when available. Do not deploy automatically.
