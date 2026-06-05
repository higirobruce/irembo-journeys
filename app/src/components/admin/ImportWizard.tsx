"use client";
/* Import-from-Irembo wizard: URL → simulated scrape → review extracted fields →
   link dependencies (auto-suggested) → save as Needs review. Ported to canonical shape. */
import { useState, useEffect } from "react";
import type { AdminState, AdminService, ScrapeDraft, ScrapeDoc } from "@/lib/adminStore";
import * as ADMIN from "@/lib/adminStore";
import type { Agency, Artifact, Rule } from "@engine/types";

const SCRAPE_STEPS = [
  "Connecting to irembo.gov.rw…",
  "Fetching service page…",
  "Reading service title & agency…",
  "Extracting required documents…",
  "Parsing fees & processing time…",
  "Matching documents to known artifacts…",
];

function ScrapeAnimation({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= SCRAPE_STEPS.length) { const t = setTimeout(onDone, 450); return () => clearTimeout(t); }
    const t = setTimeout(() => setShown((s) => s + 1), 360);
    return () => clearTimeout(t);
  }, [shown, onDone]);
  return (
    <div className="scraping">
      <div className="scrape-orb" />
      <div className="scrape-log">
        {SCRAPE_STEPS.map((s, i) => (
          <div key={i} className={`scrape-line ${i < shown ? "show" : ""}`}>
            <span className="tick">{i < shown ? "✓" : ""}</span>
            <span className={i === shown - 1 ? "mono" : ""}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type WorkingDoc = ScrapeDoc & { include: boolean; mode: "link" | "bring" | "new" };

export function ImportWizard({ state, agencies, onClose, onComplete }: {
  state: AdminState; agencies: Record<string, Agency>; onClose: () => void;
  onComplete: (svc: AdminService, newArtifacts: Record<string, Artifact>) => void;
}) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ raw: ADMIN.ScrapeCatalogEntry; draft: ScrapeDraft } | null>(null);
  const [draft, setDraft] = useState<ScrapeDraft | null>(null);
  const [docs, setDocs] = useState<WorkingDoc[]>([]);

  function runScrape() { setResult(null); setStep(2); }
  function finishScrape() {
    const r = ADMIN.scrape(state, url);
    setResult(r); setDraft(r.draft);
    setDocs(r.draft.documents.map((d) => ({ ...d, include: true, mode: d.suggestLink ? "link" : (d.isNew ? "new" : "bring") })));
  }

  const STEPS = ["Source", "Extract", "Dependencies", "Done"];

  function assemble(): { svc: AdminService; newArtifacts: Record<string, Artifact> } {
    const newArtifacts: Record<string, Artifact> = {};
    const req: string[] = [];
    docs.filter((d) => d.include).forEach((d) => {
      if (d.mode === "link") { req.push(d.artId); }
      else if (d.mode === "bring") {
        if (d.isNew) { const aid = d.artId.replace(/^new:/, ""); newArtifacts[aid] = { id: aid, name: d.artName, bring: true }; req.push(aid); }
        else { req.push(d.artId); }
      } else if (d.mode === "new") {
        const aid = d.artId.replace(/^new:/, ""); newArtifacts[aid] = { id: aid, name: d.artName, bring: true }; req.push(aid);
      }
    });
    const outId = draft!.id;
    newArtifacts[outId] = { id: outId, name: draft!.name, bring: false };
    const svc: AdminService = {
      id: draft!.id, name: draft!.name, short: draft!.short, agency: draft!.agency,
      cost: draft!.cost, duration: { min: draft!.duration.min, max: draft!.duration.max, unit: draft!.duration.unit as AdminService["duration"]["unit"] },
      hidden: !!draft!.hidden, desc: draft!.desc, requires: req, produces: [outId],
      rules: draft!.rules.map((r): Rule => ({ severity: r.severity as Rule["severity"], failureMode: r.failureMode as Rule["failureMode"], message: r.message, mitigation: r.mitigation })),
      _meta: { status: "review", source: "irembo", updated: ADMIN.today(), note: "Imported from Irembo — verify before publishing" },
    };
    return { svc, newArtifacts };
  }
  function finish() { const { svc, newArtifacts } = assemble(); onComplete(svc, newArtifacts); }

  const linkedCount = docs.filter((d) => d.include && d.mode === "link").length;
  const newCount = docs.filter((d) => d.include && (d.mode === "new" || (d.isNew && d.mode === "bring"))).length;

  return (
    <div className="modal-scrim" onClick={(e) => { if ((e.target as HTMLElement).classList.contains("modal-scrim")) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div><h2>Import from Irembo</h2><div className="mh-sub">Pull a service straight off the Irembo platform</div></div>
          <div className="wsteps">
            {STEPS.map((s, i) => (
              <span key={i} style={{ display: "contents" }}>
                <div className={`wstep ${step === i + 1 ? "on" : ""} ${step > i + 1 ? "done" : ""}`}><span className="wb">{step > i + 1 ? "✓" : i + 1}</span>{s}</div>
                {i < STEPS.length - 1 && <span className="warr">›</span>}
              </span>
            ))}
          </div>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="url-box">
              <div className="uic"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 18" /></svg></div>
              <h3>Paste an Irembo service link</h3>
              <p>We&apos;ll read the page and turn it into a structured service you can review.</p>
              <div className="url-field">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://irembo.gov.rw/home/services/…" onKeyDown={(e) => { if (e.key === "Enter") runScrape(); }} />
                <button className="btn primary" onClick={runScrape} disabled={!url}>Fetch</button>
              </div>
              <div className="url-suggest">
                <span className="us-label">Or try one from the catalog</span>
                {ADMIN.SCRAPE_CATALOG.map((c) => (
                  <div className="url-chip" key={c.id} onClick={() => setUrl(c.url)}>
                    <span style={{ color: "var(--brand)" }}>◆</span><span>{c.title}</span><span className="mono">{c.url}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && !result && <ScrapeAnimation onDone={finishScrape} />}
          {step === 2 && result && draft && <ExtractReview draft={draft} setDraft={setDraft} result={result} agencies={agencies} />}

          {step === 3 && (
            <div>
              <div className="dep-head">
                We found <b>{docs.length} required documents</b>. For each, tell us where it comes from — linking to the service that <i>produces</i> it is what draws the dependency line in the citizen graph.
              </div>
              {docs.map((d, i) => (
                <DepCard key={i} d={d} state={state} onChange={(patch) => setDocs(docs.map((x, j) => j === i ? { ...x, ...patch } : x))} />
              ))}
            </div>
          )}

          {step === 4 && draft && (
            <div style={{ textAlign: "center", padding: "20px 10px" }}>
              <div className="uic" style={{ background: "var(--green-soft)", color: "var(--green)", width: 56, height: 56, margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: "1.2rem" }}>Ready to import &ldquo;{draft.name}&rdquo;</h3>
              <p style={{ color: "var(--soft)", margin: "0 0 22px" }}>It&apos;ll be saved as <b>Needs review</b> so you can double-check before citizens see it.</p>
              <div style={{ maxWidth: 440, margin: "0 auto", textAlign: "left", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 16 }}>
                <div className="summ-row"><span>Agency</span><b>{(agencies[draft.agency] || {} as Agency).name}</b></div>
                <div className="summ-row"><span>Linked dependencies</span><b>{linkedCount}</b></div>
                <div className="summ-row"><span>New documents created</span><b>{newCount}</b></div>
                <div className="summ-row"><span>Warnings captured</span><b>{draft.rules.length}</b></div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn ghost" onClick={step === 1 ? onClose : () => setStep(step - 1)}>{step === 1 ? "Cancel" : "← Back"}</button>
          <div className="wsteps" style={{ opacity: .7 }}>
            {step === 3 && <span style={{ fontSize: ".82rem", color: "var(--soft)" }}>{linkedCount} linked · {newCount} new</span>}
          </div>
          {step === 1 && <button className="btn primary" onClick={runScrape} disabled={!url}>Fetch &amp; scan →</button>}
          {step === 2 && result && <button className="btn primary" onClick={() => setStep(3)}>Looks right — link dependencies →</button>}
          {step === 3 && <button className="btn primary" onClick={() => setStep(4)}>Review summary →</button>}
          {step === 4 && <button className="btn primary" onClick={finish}>Import to catalog</button>}
        </div>
      </div>
    </div>
  );
}

function ExtractReview({ draft, setDraft, result, agencies }: {
  draft: ScrapeDraft; setDraft: (d: ScrapeDraft) => void; result: { raw: ADMIN.ScrapeCatalogEntry }; agencies: Record<string, Agency>;
}) {
  const set = (patch: Partial<ScrapeDraft>) => setDraft({ ...draft, ...patch });
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, fontSize: ".86rem", color: "var(--green)", fontWeight: 600 }}>
        <span className="tick" style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--green)", color: "#fff", display: "grid", placeItems: "center", fontSize: ".7rem" }}>✓</span>
        Scraped <span className="mono" style={{ color: "var(--soft)" }}>{result.raw.url}</span> — review what we read:
      </div>
      <div className="extract-grid">
        <div className="efield full"><label>Service name <span className="conf high">high</span></label>
          <input type="text" value={draft.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div className="efield"><label>Agency <span className="conf med">guessed</span></label>
          <select value={draft.agency} onChange={(e) => set({ agency: e.target.value })}>
            {Object.values(agencies).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="raw-quote">&ldquo;{result.raw.agency_text}&rdquo;</div></div>
        <div className="efield"><label>Cost <span className="conf med">parsed</span></label>
          <select value={draft.cost.model} onChange={(e) => set({ cost: { model: e.target.value } })}>
            <option value="free">Free</option><option value="fee">Has a fee</option>
          </select>
          <div className="raw-quote">&ldquo;{result.raw.fee_text}&rdquo;</div></div>
        <div className="efield"><label>Processing time <span className="conf med">parsed</span></label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" value={draft.duration.max} onChange={(e) => set({ duration: { ...draft.duration, max: +e.target.value || 0 } })} style={{ width: 70 }} />
            <select value={draft.duration.unit} onChange={(e) => set({ duration: { ...draft.duration, unit: e.target.value } })}>
              <option value="day">days</option><option value="hour">hours</option><option value="min">minutes</option>
            </select>
          </div>
          <div className="raw-quote">&ldquo;{result.raw.time_text}&rdquo;</div></div>
        <div className="efield"><label>Short label</label>
          <input type="text" value={draft.short} onChange={(e) => set({ short: e.target.value })} /></div>
        <div className="efield full"><label>Description <span className="conf high">high</span></label>
          <textarea value={draft.desc} onChange={(e) => set({ desc: e.target.value })} /></div>
      </div>
    </div>
  );
}

function DepCard({ d, state, onChange }: { d: WorkingDoc; state: AdminState; onChange: (patch: Partial<WorkingDoc>) => void }) {
  const producerSvc = d.producer ? state.services[d.producer] : null;
  const linked = d.include && d.mode === "link";
  return (
    <div className={`dep-card ${linked ? "linked" : ""} ${d.isNew ? "newart" : ""}`}>
      <div className="dep-top">
        <label className={`mini-toggle ${d.include ? "on" : ""}`} onClick={() => onChange({ include: !d.include })}>
          <span className={`mini-switch ${d.include ? "on" : ""}`} />
        </label>
        <div className="dep-doc">{d.artName}<small>&ldquo;{d.raw}&rdquo;</small></div>
        {d.isNew ? <span className="dep-flag new">new document</span> : <span className="dep-flag existing">known document</span>}
      </div>
      {d.include && (
        <>
          {d.suggestLink && (
            <div className="dep-sugg">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="3" /></svg>
              Auto-detected: produced by <b style={{ margin: "0 3px" }}>{producerSvc?.short}</b> — link as a dependency?
            </div>
          )}
          <div className="dep-link-row">
            <span className="arrow"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
            <select value={d.mode === "link" ? `link:${d.producer}` : d.mode}
              onChange={(e) => { const v = e.target.value; if (v.startsWith("link:")) onChange({ mode: "link", producer: v.slice(5), artId: d.artId }); else onChange({ mode: v as WorkingDoc["mode"] }); }}>
              {d.producer && <option value={`link:${d.producer}`}>↳ Comes from: {producerSvc?.name}</option>}
              <option value="bring">Citizen brings / arranges it</option>
              {d.isNew && <option value="new">New document, citizen-arranged</option>}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
