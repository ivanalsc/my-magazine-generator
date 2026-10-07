"use client";
import { CulturalPickFeature } from "./CulturalPickFeature";
import type { CulturalPick } from "@/types/pick";
import { GUEST_ISSUE_KEY, parseGuestIssue } from "@/lib/editorial/guest";
import { HistoryModule } from "./HistoryModule";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArtworkFeature,
  IssueEnd,
  LeadStory,
  MagazineHeader,
  OutsideBubble,
  RabbitHole,
  SectionHeader,
  Story,
} from "@/components/editorial/Magazine";
import { SaveButton } from "@/components/saved/SaveButton";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { PreferenceLoading } from "@/components/preferences/PreferenceLoading";
import {
  selectedInterestNames,
  sourcesForPreferences,
} from "@/lib/preferences";
import { useAccountState } from "@/lib/repositories/account-store";
import { useMagazinePreferences } from "@/lib/useMagazinePreferences";
import type {
  IssueSection,
  UserMagazinePreferences,
  MagazineIssue,
} from "@/types/editorial";
interface IssueResponse {
  preferences?: UserMagazinePreferences;
  issue: MagazineIssue;
  fallback: boolean;
  partial: boolean;
  loadedCount: number;
  revision?: number;
  refreshAvailable?: boolean;
}
export function IssueExperience() {
  const { ready, preferences } = useMagazinePreferences();
  const account = useAccountState();
  if (!ready) return <PreferenceLoading />;
  if (!preferences && account?.mode !== "account") return <Onboarding />;
  return <IssueLoader preferences={preferences} />;
}
function IssueLoader({
  preferences,
}: {
  preferences: UserMagazinePreferences | null;
}) {
  const account = useAccountState();
  const body = JSON.stringify(preferences);
  const key = `${account?.data?.userId ?? "guest"}:${body}`;
  const [result, setResult] = useState<{
    key: string;
    response?: IssueResponse;
    error?: string;
    needsPreferences?: boolean;
  }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!account?.data?.userId && preferences) {
          try {
            const saved = JSON.parse(
              localStorage.getItem(GUEST_ISSUE_KEY) ?? "null",
            );
            const envelope = parseGuestIssue(saved?.envelope);
            const date = new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Argentina/Buenos_Aires",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date());
            if (saved?.key === key && envelope?.issue.date === date) {
              setResult({ key, response: envelope });
              return;
            }
          } catch {}
        }
        const request = await fetch("/api/issue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        const response = await request.json();
        if (request.status === 400 && !preferences) {
          if (!controller.signal.aborted)
            setResult({ key, needsPreferences: true });
          return;
        }
        if (!request.ok) throw new Error(response.error);
        if (!controller.signal.aborted) setResult({ key, response });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "We couldn’t assemble your issue.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, body, attempt, preferences, account?.data?.userId]);
  if (result?.key !== key)
    return (
      <div className="magazine-shell">
        <MagazineHeader />
        <main id="main-content" className="detail" aria-busy="true">
          <p className="eyebrow">Today’s issue</p>
          <h1>Assembling your issue…</h1>
          <p role="status">Gathering stories from your publications.</p>
        </main>
      </div>
    );
  if (result.needsPreferences) return <Onboarding />;
  if (!result.response)
    return (
      <div className="magazine-shell">
        <MagazineHeader />
        <main id="main-content" className="detail">
          <h1>Your issue needs another moment.</h1>
          <p role="alert">{result.error}</p>
          <button
            className="quiet-button"
            onClick={() => {
              setResult(undefined);
              setAttempt((value) => value + 1);
            }}
          >
            Try again →
          </button>
          <Link className="text-link" href="/interests">
            Review your sources →
          </Link>
        </main>
      </div>
    );
  const issuePreferences = result.response.preferences ?? preferences;
  if (!issuePreferences) return <Onboarding />;
  return (
    <MagazineIssueView
      key={key}
      preferences={issuePreferences}
      response={result.response}
      guestKey={account?.data?.userId ? undefined : key}
    />
  );
}
function EditorialSection({
  section,
  issue,
  refreshControl,
}: {
  section: IssueSection;
  issue: MagazineIssue;
  refreshControl?: React.ReactNode;
}) {
  const stories = section.storyIds
    .map((id) => issue.stories.find((story) => story.id === id)!)
    .filter(Boolean);
  const cultural = section.culturalItemIds
    .map((id) => issue.culturalItems.find((item) => item.id === id)!)
    .filter(Boolean);
  return (
    <section
      className="editorial-section"
      aria-labelledby={`${section.id}-title`}
    >
      <div id={`${section.id}-title`}>
        <SectionHeader
          title={section.title}
          number={`${stories.length + cultural.length} discoveries`}
        />
      </div>
      <p className="meta section-context">
        {section.id === "publications"
          ? "From your selected publications"
          : `From your ${section.title} interests`}
      </p>
      <div
        className={`live-section-grid ${stories.length === 1 ? "single-story" : stories.length === 2 ? "two-stories" : ""}`}
      >
        {stories.map((story, index) => (
          <Story
            key={story.id}
            article={story}
            variant={index === 0 ? "large" : index === 1 ? "text" : "compact"}
          />
        ))}
        {cultural.map((item) => (
          <article className="cultural-small" key={item.id}>
            <p className="eyebrow">A cultural discovery · {item.source.name}</p>
            <h3>
              <Link href={item.internalUrl}>{item.title}</Link>
            </h3>
            <p>{item.description}</p>
            <Link href={item.internalUrl} className="text-link">
              Discover →
            </Link>
            <p className="license-small">{item.attribution}</p>
            <SaveButton item={item} />
          </article>
        ))}
      </div>
      {refreshControl}
    </section>
  );
}
export function MagazineIssueView({
  preferences,
  response,
  archived = false,
  guestKey,
}: {
  preferences: UserMagazinePreferences;
  response: IssueResponse;
  archived?: boolean;
  guestKey?: string;
}) {
  const account = useAccountState();
  const [accepted, setAccepted] = useState<{
    base: IssueResponse;
    response: IssueResponse;
  }>();
  const shown = accepted?.base === response ? accepted.response : response;
  const [pending, setPending] = useState<string>();
  const [notice, setNotice] = useState<{ section: string; text: string }>();
  const inFlight = useRef(false),
    controller = useRef<AbortController | null>(null),
    lastRequest = useRef(0);
  useEffect(() => () => controller.current?.abort(), []);
  async function refresh(section: string) {
    if (inFlight.current || Date.now() - lastRequest.current < 2000) return;
    inFlight.current = true;
    lastRequest.current = Date.now();
    setPending(section);
    setNotice(undefined);
    controller.current = new AbortController();
    let failureMessage: string | undefined;
    try {
      const request = await fetch("/api/issue/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(30_000),
        ]),
        body: JSON.stringify({
          issueId: shown.issue.id,
          sectionId: section,
          expectedRevision: shown.revision ?? 0,
          ...(!account?.data?.userId
            ? { envelope: { ...shown, preferences } }
            : {}),
        }),
      });
      const result = await request.json();
      if (!request.ok) {
        failureMessage =
          typeof result.error === "string" ? result.error : undefined;
        throw new Error("Refresh failed");
      }
      if (result.changed) {
        if (guestKey) {
          try {
            localStorage.setItem(
              GUEST_ISSUE_KEY,
              JSON.stringify({ key: guestKey, envelope: result.envelope }),
            );
          } catch {
            setNotice({
              section,
              text: "Another selection is ready. This device couldn’t keep it after reload.",
            });
          }
        }
        setAccepted({ base: response, response: result.envelope });
      }
      setNotice((current) => current ?? { section, text: result.message });
    } catch {
      if (!controller.current.signal.aborted)
        setNotice({
          section,
          text:
            failureMessage ??
            "We couldn’t reach another selection. Your current content is still here. Please try again.",
        });
    } finally {
      inFlight.current = false;
      if (!controller.current.signal.aborted) setPending(undefined);
    }
  }
  const { issue } = shown;
  const names = selectedInterestNames(preferences);
  const sources = sourcesForPreferences(preferences);
  const leadId = issue.sections.find((section) => section.id === "lead")
    ?.storyIds[0];
  const lead = issue.stories.find((story) => story.id === leadId);
  const outsideId = issue.sections.find((section) => section.id === "outside")
    ?.storyIds[0];
  const outside = issue.stories.find((story) => story.id === outsideId);
  const sections = issue.sections.filter(
    (section) => !["lead", "outside"].includes(section.id),
  );
  const rabbit = issue.culturalItems.find(
    (item) => item.kind === "rabbit-hole",
  );
  const artwork = issue.culturalItems.find((item) => item.kind === "artwork");
  const history = issue.onThisDay ?? [];
  return (
    <div className="magazine-shell">
      <MagazineHeader
        active={archived ? "archive" : "issue"}
        date={issue.date}
        number={issue.number}
      />
      <main id="main-content">
        {archived && (
          <p className="archive-reading-note">
            From your archive · your final selection.{" "}
            <Link href="/archive">Back to the shelf →</Link>
          </p>
        )}
        <div className="issue-intro">
          <div>
            <p className="eyebrow accent">
              Made for you ·{" "}
              {new Date(`${issue.date}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
              })}
            </p>
            <h1>A magazine made from the things you’re curious about.</h1>
          </div>
          <div className="issue-context">
            <p>
              Made from your choices
              <br />
              <strong>
                {names.length} interests · {shown.loadedCount} connected sources
              </strong>
            </p>
            <span className="meta">
              {issue.stories.length +
                issue.culturalItems.length +
                history.length}{" "}
              discoveries ·{" "}
              {shown.fallback
                ? "Sample selection"
                : archived
                  ? "Archived issue"
                  : "Today’s issue"}
            </span>
          </div>
        </div>
        <div className="issue-preferences">
          <p>
            <span className="eyebrow">Your interests</span>
            {names.join(" · ")}
          </p>
          <details>
            <summary>
              Your sources <span aria-hidden="true">+</span>
            </summary>
            <p>{sources.map((source) => source.name).join(" · ")}</p>
            <p className="meta">
              Publisher stories open at their original source. Cultural
              discoveries retain their source and license.{" "}
              <Link href="/about">About the content →</Link>
            </p>
          </details>
        </div>
        {shown.fallback && (
          <p className="sample-note">
            No connected feed could fill your selected interests today. This
            selection includes clearly fictional sample stories while your
            source choices stay saved.
          </p>
        )}
        {shown.partial && (
          <p className="meta availability-note">
            Some selected publications aren’t available yet. Your issue uses the
            sources we could load.
          </p>
        )}
        {lead && <LeadStory article={lead} />}
        {sections[0] && (
          <EditorialSection
            section={sections[0]}
            issue={issue}
            refreshControl={
              <SectionRefresh
                section={sections[0].id}
                label={`Different ${sections[0].title} stories →`}
                enabled={!archived && shown.refreshAvailable !== false}
                pending={pending}
                notice={notice}
                onRefresh={refresh}
              />
            }
          />
        )}
        {rabbit && (
          <div aria-busy={pending === "rabbit-hole"}>
            <RabbitHole item={rabbit} />
            {
              <SectionRefresh
                section="rabbit-hole"
                label="Take me somewhere else →"
                enabled={!archived && shown.refreshAvailable !== false}
                pending={pending}
                notice={notice}
                onRefresh={refresh}
              />
            }
          </div>
        )}
        {sections[1] && (
          <EditorialSection
            section={sections[1]}
            issue={issue}
            refreshControl={
              <SectionRefresh
                section={sections[1].id}
                label={`Different ${sections[1].title} stories →`}
                enabled={!archived && shown.refreshAvailable !== false}
                pending={pending}
                notice={notice}
                onRefresh={refresh}
              />
            }
          />
        )}
        {artwork && (
          <div aria-busy={pending === "artwork"}>
            <ArtworkFeature key={artwork.id} item={artwork} />
            {
              <SectionRefresh
                section="artwork"
                label="Show me another artwork →"
                enabled={!archived && shown.refreshAvailable !== false}
                pending={pending}
                notice={notice}
                onRefresh={refresh}
              />
            }
          </div>
        )}
        {issue.culturalItems
          .filter((i) => i.kind === "cultural-pick")
          .map((item) => (
            <div key={item.id} aria-busy={pending === "cultural-pick"}>
              <CulturalPickFeature
                item={item as CulturalPick}
                refreshControl={
                  <SectionRefresh
                    section="cultural-pick"
                    label="Another pick →"
                    enabled={!archived && shown.refreshAvailable !== false}
                    pending={pending}
                    notice={notice}
                    onRefresh={refresh}
                  />
                }
              />
            </div>
          ))}
        {sections.slice(2).map((section) => (
          <EditorialSection
            key={section.id}
            section={section}
            issue={issue}
            refreshControl={
              <SectionRefresh
                section={section.id}
                label={`Different ${section.title} stories →`}
                enabled={!archived && shown.refreshAvailable !== false}
                pending={pending}
                notice={notice}
                onRefresh={refresh}
              />
            }
          />
        ))}
        {(history.length > 0 || outside) && (
          <div
            className={`closing-grid ${!history.length || !outside ? "single-closing" : ""}`}
          >
            {history.length > 0 && (
              <HistoryModule events={history} date={issue.date} />
            )}
            {outside && <OutsideBubble article={outside} />}
          </div>
        )}
      </main>
      <IssueEnd number={issue.number} />
    </div>
  );
}
function SectionRefresh({
  section,
  label,
  enabled,
  pending,
  notice,
  onRefresh,
}: {
  section: string;
  label: string;
  enabled: boolean;
  pending?: string;
  notice?: { section: string; text: string };
  onRefresh: (section: string) => Promise<void>;
}) {
  if (!enabled) return null;
  return (
    <div className="section-refresh" aria-busy={pending === section}>
      <button
        className="quiet-button"
        disabled={!!pending}
        onClick={() => void onRefresh(section)}
        aria-label={label}
      >
        {pending === section ? "Finding another selection…" : label}
      </button>
      <p className="meta" role="status" aria-live="polite">
        {notice?.section === section
          ? notice.text
          : pending === section
            ? "Your current selection stays here while we look."
            : ""}
      </p>
    </div>
  );
}
