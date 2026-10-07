import { MagazineHeader } from "@/components/editorial/Magazine";
export function PreferenceLoading() {
  return (
    <div className="magazine-shell">
      <MagazineHeader compact />
      <main id="main-content" className="preference-loading" aria-busy="true">
        <p className="eyebrow">My Magazine Generator</p>
        <h1>Your magazine, your curiosity.</h1>
        <p role="status">Opening your magazine…</p>
      </main>
    </div>
  );
}
