"use client";
import { useState, useMemo } from "react";
import type { AdminState } from "@/lib/adminStore";
import * as ADMIN from "@/lib/adminStore";
import type { Agency } from "@engine/types";
import { AgencyIcons } from "@/components/icons";

export function StatusPill({ s }: { s: string }) {
  const label = ({ published: "Published", review: "Needs review", draft: "Draft" } as Record<string, string>)[s] || s;
  return <span className={`st ${s}`}>{label}</span>;
}

function ServiceRow({ id, svc, agencies, used, onOpen }: {
  id: string; svc: AdminState["services"][string]; agencies: Record<string, Agency>;
  used: { id: string }[]; onOpen: (id: string) => void;
}) {
  const ag = agencies[svc.agency] || ({ color: "#888", name: svc.agency } as Agency);
  return (
    <div className="tbl-row item" onClick={() => onOpen(id)}>
      <div className="svc-name">
        <span className="svc-ico" style={{ background: ag.color }}>{AgencyIcons[svc.agency]}</span>
        <span className="t"><b>{svc.name}</b><small>{svc.short}</small></span>
      </div>
      <div className="ag-tag"><i style={{ background: ag.color }} />{ag.name}</div>
      <div><StatusPill s={svc._meta.status} /></div>
      <div className="src">
        {svc._meta.source === "irembo"
          ? <><span style={{ color: "var(--brand)", fontWeight: 700 }}>◆</span> Irembo scrape</>
          : <><span style={{ color: "var(--faint)" }}>✎</span> Manual</>}
      </div>
      <div className="used">{used.length ? `${used.length} journey${used.length > 1 ? "s" : ""}` : "—"}</div>
      <div className="rowarr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </div>
  );
}

export function Catalog({ state, agencies, onOpen }: {
  state: AdminState; agencies: Record<string, Agency>; onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");
  const counts = useMemo(() => ADMIN.statusCounts(state), [state]);
  const rows = useMemo(() => {
    const order: Record<string, number> = { review: 0, draft: 1, published: 2 };
    return Object.entries(state.services)
      .filter(([, s]) => statusF === "all" || s._meta.status === statusF)
      .filter(([, s]) => !q || (s.name + " " + (s.short || "")).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => order[a[1]._meta.status] - order[b[1]._meta.status] || a[1].name.localeCompare(b[1].name));
  }, [state, q, statusF]);

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="v">{Object.keys(state.services).length}</div><div className="k">Total services</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--green)" }}>{counts.published}</div><div className="k"><i style={{ background: "var(--green)" }} />Published &amp; live</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--amber)" }}>{counts.review}</div><div className="k"><i style={{ background: "var(--amber)" }} />Awaiting review</div></div>
        <div className="kpi"><div className="v">{Object.keys(state.journeys).length}</div><div className="k">Journeys assembled</div></div>
      </div>
      <div className="toolbar">
        <div className="adm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" />
        </div>
        <div className="seg">
          {["all", "published", "review", "draft"].map((s) => (
            <button key={s} className={statusF === s ? "on" : ""} onClick={() => setStatusF(s)}>
              {s === "all" ? "All" : s === "review" ? "Needs review" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="tbl">
        <div className="tbl-row tbl-head"><div>Service</div><div>Agency</div><div>Status</div><div>Source</div><div>Used in</div><div></div></div>
        {rows.length === 0 && <div className="tbl-empty">No services match.</div>}
        {rows.map(([id, svc]) => (
          <ServiceRow key={id} id={id} svc={svc} agencies={agencies} used={ADMIN.journeysUsing(state, id)} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

export function ReviewQueue({ state, agencies, onOpen, onApprove }: {
  state: AdminState; agencies: Record<string, Agency>; onOpen: (id: string) => void; onApprove: (id: string) => void;
}) {
  const items = useMemo(() => Object.entries(state.services)
    .filter(([, s]) => s._meta.status !== "published")
    .sort((a, b) => (a[1]._meta.status === "review" ? -1 : 1)), [state]);

  if (!items.length) return (
    <div className="tbl-empty" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)" }}>
      🎉 Nothing waiting — every service is published.
    </div>
  );
  return (
    <div>
      {items.map(([id, svc]) => {
        const ag = agencies[svc.agency] || ({} as Agency);
        return (
          <div className="review-card" key={id} style={{ borderLeftColor: svc._meta.status === "draft" ? "var(--faint)" : "var(--amber)" }}>
            <span className="svc-ico" style={{ background: ag.color, width: 38, height: 38 }}>{AgencyIcons[svc.agency]}</span>
            <div className="rc-body">
              <b>{svc.name}</b> <StatusPill s={svc._meta.status} />
              <p>{svc._meta.note || svc.desc}</p>
            </div>
            <div className="rc-actions">
              <button className="btn outline sm" onClick={() => onOpen(id)}>Review</button>
              <button className="btn primary sm" onClick={() => onApprove(id)}>Approve &amp; publish</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
