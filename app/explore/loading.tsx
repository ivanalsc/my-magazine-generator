import { MagazineHeader } from "@/components/editorial/Magazine";
export default function Loading() {
  return (
    <div className="magazine-shell">
      <MagazineHeader active="" />
      <main id="main-content" className="detail" aria-busy="true">
        <p className="eyebrow">Cultural discovery</p>
        <h1>Opening the collection…</h1>
        <p role="status">Loading the original source.</p>
      </main>
    </div>
  );
}
