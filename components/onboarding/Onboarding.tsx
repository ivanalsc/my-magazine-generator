"use client";
import { useAccountState } from "@/lib/repositories/account-store";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagazineHeader } from "@/components/editorial/Magazine";
import { PreferenceLoading } from "@/components/preferences/PreferenceLoading";
import { enabledSources } from "@/lib/sources/registry";
import { publicationGroups } from "@/lib/sources/publications";
import { selectableInterests, sourceCatalog } from "@/data/catalog";
import { MIN_INTERESTS } from "@/lib/preferences";
import {
  savePreferences,
  useMagazinePreferences,
} from "@/lib/useMagazinePreferences";
import type { UserMagazinePreferences } from "@/types/editorial";
function toggle(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
export function Onboarding({
  initialStep = 1,
  editing = false,
}: {
  initialStep?: 1 | 2;
  editing?: boolean;
}) {
  const { ready, preferences } = useMagazinePreferences();
  if (!ready) return <PreferenceLoading />;
  return (
    <OnboardingForm
      initialStep={preferences || initialStep === 1 ? initialStep : 1}
      editing={editing && !!preferences}
      initialPreferences={preferences}
    />
  );
}
function OnboardingForm({
  initialStep,
  editing,
  initialPreferences,
}: {
  initialStep: 1 | 2;
  editing: boolean;
  initialPreferences: UserMagazinePreferences | null;
}) {
  const router = useRouter();
  const account = useAccountState();
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [selectedInterests, setInterests] = useState<string[]>(
    initialPreferences?.interests ?? [],
  );
  const [selectedSources, setSources] = useState<string[]>(
    (initialPreferences?.sources ?? []).filter((id) =>
      enabledSources.some((source) => source.id === id),
    ),
  );
  const customSources = initialPreferences?.customSources ?? [];
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const headline = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      headline.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
      previousStep.current = step;
    }
  }, [step]);
  const totalSources = selectedSources.length;
  const groups = [...publicationGroups].sort(
    (a, b) =>
      Number(b.interestIds.some((id) => selectedInterests.includes(id))) -
      Number(a.interestIds.some((id) => selectedInterests.includes(id))),
  );
  async function finish(skip = false) {
    if (selectedInterests.length < MIN_INTERESTS) {
      setStep(1);
      setSaveError("Choose at least three interests.");
      return;
    }
    if (saving) return;
    setSaving(true);
    const error = await savePreferences({
      version: 1,
      interests: selectedInterests,
      sources: skip ? [] : selectedSources,
      customSources,
    });
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    router.push("/");
    router.refresh();
  }
  return (
    <div className="magazine-shell onboarding-shell">
      <MagazineHeader compact />
      <main id="main-content" className="onboarding">
        <div className="onboarding-progress">
          <ol aria-label="Making your magazine">
            <li aria-current={step === 1 ? "step" : undefined}>
              <span>01</span> Your interests{" "}
              {step === 2 && <span aria-label="Complete">✓</span>}
            </li>
            <li aria-current={step === 2 ? "step" : undefined}>
              <span>02</span> Your sources <small>Optional</small>
            </li>
          </ol>
          <span className="meta">
            {editing ? "Your next composition" : "The beginning of your issue"}
          </span>
        </div>
        <div className="onboarding-intro">
          <div>
            <p className="eyebrow accent">
              {step === 1
                ? "Start with what moves you"
                : "Build your magazine rack"}
            </p>
            <h1 ref={headline} tabIndex={-1}>
              {step === 1
                ? "What are you curious about?"
                : "Any publications you already love?"}
            </h1>
            <p>
              {step === 1
                ? "Pick the things you’d like to find in your magazine."
                : "Choose a few publications, or let us find interesting things for you."}
            </p>
          </div>
          <div className="onboarding-margin">
            <span aria-hidden="true">✳</span>
            <p>A magazine made from the things you’re curious about.</p>
            <p className="meta">Curated, never rewritten.</p>
          </div>
        </div>
        {step === 1 ? (
          <>
            <fieldset className="selection-fieldset">
              <legend className="sr-only">
                Choose at least three interests
              </legend>
              <div className="interest-index">
                {selectableInterests.map((interest, index) => {
                  const selected = selectedInterests.includes(interest.id);
                  return (
                    <button
                      type="button"
                      key={interest.id}
                      className={`interest-choice ${selected ? "is-selected" : ""}`}
                      aria-pressed={selected}
                      onClick={() => {
                        setInterests((ids) => toggle(ids, interest.id));
                        setSaveError("");
                      }}
                    >
                      <span className="index-number" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="interest-name">{interest.name}</span>
                      <span className="selection-mark" aria-hidden="true">
                        {selected ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="onboarding-actions">
              <div>
                <p className="selection-count" role="status">
                  {selectedInterests.length} selected
                </p>
                <p className="meta" id="minimum-help">
                  Choose at least {MIN_INTERESTS}. There’s room for more.
                </p>
              </div>
              <button
                className="editorial-button"
                type="button"
                disabled={selectedInterests.length < MIN_INTERESTS}
                aria-describedby="minimum-help"
                onClick={() => {
                  setSaveError("");
                  setStep(2);
                }}
              >
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="source-selection-bar">
              <p className="selection-count" role="status">
                {totalSources} {totalSources === 1 ? "source" : "sources"}{" "}
                selected
              </p>
              <p className="meta">A few favourites, or none at all.</p>
            </div>
            <fieldset className="selection-fieldset">
              <legend className="sr-only">
                Select publications for your magazine. This step is optional.
              </legend>
              <div className="source-catalog">
                {groups.map((group) => (
                  <section
                    className="source-group"
                    aria-labelledby={`group-${group.id}`}
                    key={group.id}
                  >
                    <div className="source-group-label">
                      <h2 id={`group-${group.id}`}>{group.name}</h2>
                      {group.interestIds.some((id) =>
                        selectedInterests.includes(id),
                      ) && <span>From your interests</span>}
                    </div>
                    <div
                      className={`publication-rack rack-${group.sourceIds.length}`}
                    >
                      {group.sourceIds.map((id) => {
                        const source = sourceCatalog.find(
                          (item) => item.id === id,
                        )!;
                        const selected = selectedSources.includes(id);
                        return (
                          <button
                            className={`publication-choice ${selected ? "is-selected" : ""}`}
                            type="button"
                            key={id}
                            aria-pressed={selected}
                            onClick={() => {
                              setSources((ids) => toggle(ids, id));
                            }}
                          >
                            <span className="publication-selection">
                              <span>
                                {selected ? "Selected" : "Select publication"}
                              </span>
                              <span aria-hidden="true">
                                {selected ? "✓" : "+"}
                              </span>
                            </span>
                            <span className="publication-name">
                              {source.name}
                            </span>
                            <span className="publication-category">
                              {source.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </fieldset>
            <aside className="cultural-included">
              <p className="eyebrow">
                Cultural discovery · Included in your magazine
              </p>
              <p className="meta">
                A Wikipedia rabbit hole and an artwork from The Met’s open
                collection can appear alongside your publications.
              </p>
            </aside>
            <div className="onboarding-actions source-actions">
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setSaveError("");
                  setStep(1);
                }}
              >
                ← Back to interests
              </button>
              <div>
                <button
                  className="editorial-button"
                  type="button"
                  disabled={saving}
                  onClick={() => void finish()}
                >
                  {editing ? "Update my magazine →" : "Generate my magazine →"}
                </button>
                <button
                  type="button"
                  className="skip-source-button"
                  disabled={saving}
                  onClick={() => void finish(true)}
                >
                  Skip this step →
                </button>
              </div>
            </div>
          </>
        )}
        {saveError && (
          <p role="alert" className="form-error">
            {saveError}
          </p>
        )}
        <div className="onboarding-footnote">
          <span>
            {account?.mode === "account"
              ? "Saved to your account. Choices shape your next issue."
              : "Stored on this device. Always yours to change."}
          </span>
          {editing && <Link href="/interests">Cancel changes</Link>}
        </div>
      </main>
    </div>
  );
}
