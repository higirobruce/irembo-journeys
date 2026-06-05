"use client";
import { useState, useEffect, useMemo } from "react";
import { AGENCIES } from "@/lib/data";
import * as ADMIN from "@/lib/adminStore";
import type { AdminState, AdminService } from "@/lib/adminStore";
import type { Artifact } from "@engine/types";
import { Catalog, ReviewQueue } from "./Catalog";
import { JourneysView } from "./JourneysView";
import { ServiceEditor } from "./ServiceEditor";
import { ImportWizard } from "./ImportWizard";

const NAV = {
  catalog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  review: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  journeys: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="18" r="2.5" /><path d="M7.5 6H14a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h0" /></svg>,
};

export function AdminApp() {
  const [state, setState] = useState<AdminState>(() => ADMIN.initialState());
  const [section, setSection] = useState<"catalog" | "review" | "journeys">("catalog");
  const [editId, setEditId] = useState<string | null | undefined>(undefined);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { ADMIN.save(state); }, [state]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", localStorage.getItem("irembo.theme") || "light"); }, []);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };
  const counts = useMemo(() => ADMIN.statusCounts(state), [state]);

  function saveService(d: AdminService, action: "draft" | "publish") {
    const id = d.id || ADMIN.slugify(d.name);
    const status = action === "publish" ? "published" : "draft";
    setState((s) => ({ ...s, services: { ...s.services, [id]: { ...d, id, _meta: { ...d._meta, status, updated: ADMIN.today() } } } }));
    setEditId(undefined);
    flash(action === "publish" ? "Service published — live in the citizen graph" : "Saved as draft");
  }
  function approve(id: string) {
    setState((s) => ({ ...s, services: { ...s.services, [id]: { ...s.services[id], _meta: { ...s.services[id]._meta, status: "published", updated: ADMIN.today() } } } }));
    flash("Approved & published");
  }
  function importComplete(svc: AdminService, newArtifacts: Record<string, Artifact>) {
    setState((s) => ({ ...s, artifacts: { ...s.artifacts, ...newArtifacts }, services: { ...s.services, [svc.id]: svc } }));
    setImporting(false); setSection("review");
    flash(`Imported "${svc.name}" — added to the review queue`);
  }
  function resetAll() {
    if (!confirm("Reset all admin changes back to the seed data?")) return;
    ADMIN.clear(); setState(ADMIN.initialState()); flash("Reset to seed data");
  }

  const heads = {
    catalog: { crumb: "Services", title: "Service catalog", sub: "Every government service, its dependencies, and where it shows up for citizens." },
    review: { crumb: "Quality", title: "Review queue", sub: "Scraped and draft services waiting to be checked before they go live." },
    journeys: { crumb: "Journeys", title: "Journeys", sub: "How services are assembled into the paths citizens follow." },
  }[section];
  const editing = editId !== undefined;

  return (
    <div className="admin">
      <aside className="side">
        <div className="side-brand">
          <div className="glyph"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="12" r="2.4" /><path d="M8 7l8 4M8 17l8-4" /></svg></div>
          <div className="nm"><span className="t">Journey Companion</span><span className="s">Admin console</span></div>
        </div>
        <nav className="side-nav">
          <div className="nlabel">Manage</div>
          <button className={`nav-item ${section === "catalog" && !editing ? "on" : ""}`} onClick={() => { setSection("catalog"); setEditId(undefined); }}>{NAV.catalog} Catalog <span className="count">{Object.keys(state.services).length}</span></button>
          <button className={`nav-item ${section === "review" && !editing ? "on" : ""}`} onClick={() => { setSection("review"); setEditId(undefined); }}>{NAV.review} Review queue {counts.review + counts.draft > 0 && <span className="count alert">{counts.review + counts.draft}</span>}</button>
          <button className={`nav-item ${section === "journeys" && !editing ? "on" : ""}`} onClick={() => { setSection("journeys"); setEditId(undefined); }}>{NAV.journeys} Journeys <span className="count">{Object.keys(state.journeys).length}</span></button>
          <div className="nlabel">Add</div>
          <button className="nav-item" onClick={() => setImporting(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg> Import from Irembo</button>
          <button className="nav-item" onClick={() => setEditId(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> New service</button>
        </nav>
        <div className="side-foot">
          <a href="/"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg> Open citizen app</a>
          <a onClick={resetAll} style={{ cursor: "pointer" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg> Reset demo data</a>
        </div>
      </aside>

      <main className="main">
        {editing ? (
          <>
            <div className="main-head"><div><div className="crumb">{editId ? "Catalog › Edit" : "Catalog › New"}</div><h1>{editId ? state.services[editId].name : "Create a service"}</h1></div></div>
            <div className="main-body">
              <ServiceEditor state={state} agencies={AGENCIES} editId={editId} onCancel={() => setEditId(undefined)} onSave={saveService} />
            </div>
          </>
        ) : (
          <>
            <div className="main-head">
              <div><div className="crumb">{heads.crumb}</div><h1>{heads.title}</h1><p>{heads.sub}</p></div>
              <div className="main-actions">
                {section !== "journeys" && (
                  <>
                    <button className="btn outline sm icon" onClick={() => setEditId(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg> New service</button>
                    <button className="btn primary sm icon" onClick={() => setImporting(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg> Import from Irembo</button>
                  </>
                )}
              </div>
            </div>
            <div className="main-body">
              {section === "catalog" && <Catalog state={state} agencies={AGENCIES} onOpen={setEditId} />}
              {section === "review" && <ReviewQueue state={state} agencies={AGENCIES} onOpen={setEditId} onApprove={approve} />}
              {section === "journeys" && <JourneysView state={state} agencies={AGENCIES} />}
            </div>
          </>
        )}
      </main>

      {importing && <ImportWizard state={state} agencies={AGENCIES} onClose={() => setImporting(false)} onComplete={importComplete} />}
      {toast && <div className="toast"><span className="tk">✓</span>{toast}</div>}
    </div>
  );
}
