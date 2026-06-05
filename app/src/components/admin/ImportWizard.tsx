"use client";
/* Import-from-Irembo wizard — PLACEHOLDER for this slice.
   Full flow (paste URL -> simulated scrape -> extract review -> auto-linked
   dependency editor -> review queue) lands in the next commit on this branch.
   The scrape simulation + dependency auto-matcher will live in adminStore. */
export function ImportWizard({ onClose }: { onClose: () => void; onComplete?: () => void }) {
  return (
    <>
      <div className="modal-scrim" onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,22,32,.4)", zIndex: 80 }} />
      <div role="dialog" aria-label="Import from Irembo"
        style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 81,
          width: 460, maxWidth: "92vw", background: "var(--paper)", border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-pop)", padding: "24px 26px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--brand-soft)", color: "var(--brand)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
          </span>
          <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Import from Irembo</h3>
        </div>
        <p style={{ color: "var(--soft)", fontSize: ".92rem", margin: "0 0 8px" }}>
          The 4-step wizard — <b>paste a service URL → simulated scrape → review the extracted fields →
          auto-link dependencies</b> — is the next commit on this branch.
        </p>
        <p style={{ color: "var(--faint)", fontSize: ".82rem", margin: "0 0 18px" }}>
          The headline feature: every required document is matched to a known artifact, and where another
          service <i>produces</i> it, the dependency edge is auto-suggested (with manual override). Imports
          land here in the review queue as &ldquo;Needs review&rdquo;.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </>
  );
}
