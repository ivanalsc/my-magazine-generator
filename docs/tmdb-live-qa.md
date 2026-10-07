# Live Cultural Pick QA — October 7, 2026

Verification only. No application, UI, eligibility, balancing, persistence or rights code changed. All scripts/payloads used for diagnostics are under ignored `qa/`. Token values were neither printed nor persisted in diagnostics.

## Live provider counts

For interests **Art & Culture, Design, Music, Travel, Film**, the current provider adapters produced:

| Type | Normalized candidates |
| --- | ---: |
| TMDB Film | 40 |
| TMDB TV | 40 |
| MusicBrainz Album | 29 |
| Open Library Book | 28 |

TMDB counts comprise both existing date ranges (20 results per range), using the application's genre, date and English localization parameters. These are normalized discovery records; selection still hydrates Film/TV details and checks creator/quality before accepting a pick. Book count is the first healthy subject pool, not the sum of every eligible subject. Album search returned 30 records; 29 survived existing quality checks.

MusicBrainz initially returned HTTP 503, then recovered on a real retry. Provider health is transient; the observed successful paths do not imply future requests cannot fail.

## TMDB verification

- `TMDB_READ_ACCESS_TOKEN` is present; real authenticated TMDB requests succeeded. Local Explore pages also returned HTTP 200, verifying the running application uses the credential.
- Film and TV discovery both returned normalized candidates where eligible.
- Real details for *Spirited Away* (Japanese original language) normalized to the English localized title and retained Hayao Miyazaki, 2001 and its own poster.
- In the new issue/revisions, *Stromboli* (Italian), *Trick* (Japanese TV) and *The Thorn and the Rose* (Portuguese TV) remained eligible. Display strings were used verbatim from TMDB `language=en-US` responses; no translation was generated.
- Every selected Film/TV was compared with a fresh detail response for the exact provider ID: identity, localized title, poster URL, director/creators, year and genre list all matched.
- Explore URLs returned HTTP 200 with the exact selected `data-pick-id` and poster. No cross-item metadata or poster mismatch was observed.
- Detail pages contain `Metadata: TMDB` and the correct original TMDB item link. The Sources page contains the approved TMDB logo and the required non-endorsement notice. The full notice is on Sources, not repeated on every Explore page.

## New issue and Another pick

A **new isolated guest issue**, with no prior Cultural Pick history, was generated through `/api/issue`. Nine successive `/api/issue/refresh` requests exercised the same endpoint used by Another pick. All returned successfully and accepted a distinct identity:

1. Film — Three Came Home
2. Album — This Sentence Is True (The Previous Sentence Is False)
3. Book — If you decide to go to the moon
4. TV — Trick
5. Album — Digital Prophecy
6. Book — Masonic antiquities of the Orient unveiled
7. Film — Stromboli
8. Album — Shamania
9. Book — Chefs of the Coast
10. TV — The Thorn and the Rose

Observed groups: screen 4, album 3, book 3. All four eligible media types appeared. This verifies cross-type changes without forcing a rotation. Individual examples differ from Album → Film → Book → Album because the existing algorithm uses deterministic preferences/history and treats Film/TV as one screen group.

Code inspection confirms group/type ordering happens before provider pools are consulted. The 80 combined screen discovery records did not give screen 80 separate selection weights. Pool sizes do not enter type ordering. Existing regression tests cover unequal pool sizes; no selection rule was changed.

The guest QA issue and revisions were not written to an account Archive or substituted for an existing persisted issue.

## Individual provider failure simulations

Using real live candidate pools and the existing selector, controlled provider exceptions were injected in the diagnostic process. Existing current/history preferences placed the failing provider first; no selection code was modified:

| Unavailable provider | Actual attempt sequence | Result |
| --- | --- | --- |
| TMDB | Film failure → TV failure → Album | Album |
| MusicBrainz | Album failure → Film | Film |
| Open Library | Book failure → Film | Film |

Every simulation produced a valid candidate from another provider. TMDB detail hydration of fallback Film candidates used real requests. No mock candidate or production fallback content was inserted.

## Result

All requested live checks and provider failure simulations passed. No implementation bug requiring UI or selection changes was found. The earlier reliability correction had already passed 73 tests, lint and the production Webpack build; this verification introduced no application changes requiring those checks to be rerun.
