"use client";
import type { AdminState } from "@/lib/adminStore";
import * as ADMIN from "@/lib/adminStore";
import type { Agency } from "@engine/types";
import { AgencyIcons } from "@/components/icons";

interface Draft { id?: string; agency: string; short?: string; name?: string; requires?: string[]; produces?: string[]; }

export function MiniGraph({ state, draft, agencies }: { state: AdminState; draft: Draft; agencies: Record<string, Agency> }) {
  const services = state.services;
  const req = draft.requires || [];
  const pro = draft.produces || [];

  const incoming: { id: string; svc: { agency: string; short?: string; name?: string }; art: string }[] = [];
  req.forEach((art) => {
    const pid = ADMIN.producerOf(state, art);
    if (pid && pid !== draft.id) incoming.push({ id: pid, svc: services[pid], art });
  });
  const outgoing: { id: string; svc: { agency: string; short?: string; name?: string }; art: string }[] = [];
  Object.entries(services).forEach(([sid, s]) => {
    if (sid === draft.id) return;
    const shared = (s.requires || []).find((a) => pro.includes(a));
    if (shared) outgoing.push({ id: sid, svc: s, art: shared });
  });
  const brought = req.filter((a) => !ADMIN.producerOf(state, a));

  const NodeMini = ({ svc, agId, center }: { svc: { agency?: string; short?: string; name?: string }; agId: string; center?: boolean }) => {
    const ag = agencies[agId] || ({ color: "#888", name: agId } as Agency);
    return (
      <div className={`mini-node ${center ? "center" : ""}`} style={{ ["--ag" as string]: ag.color } as React.CSSProperties}>
        <span className="mini-ico" style={{ background: ag.color }}>{AgencyIcons[agId]}</span>
        <span className="mini-nm">{svc.short || svc.name || "Untitled"}</span>
      </div>
    );
  };

  const hasNeighbors = incoming.length || outgoing.length;
  return (
    <div className="minigraph">
      <div className="mini-col">
        <div className="mini-col-label">Comes before</div>
        {incoming.length === 0 && <div className="mini-empty">No upstream services</div>}
        {incoming.map((n, i) => (
          <div className="mini-with-edge" key={i}>
            <NodeMini svc={n.svc} agId={n.svc.agency} />
            <span className="mini-edge-label">{(state.artifacts[n.art] || {}).name || n.art}</span>
          </div>
        ))}
        {brought.map((a, i) => (
          <div className="mini-bring" key={"b" + i}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M3 12h18M3 17h18" /></svg>
            {(state.artifacts[a] || {}).name || a}<small>citizen brings</small>
          </div>
        ))}
      </div>
      <div className="mini-center">
        <div className="mini-connector left" data-on={incoming.length > 0} />
        <NodeMini svc={draft} agId={draft.agency} center />
        <div className="mini-connector right" data-on={outgoing.length > 0} />
      </div>
      <div className="mini-col">
        <div className="mini-col-label">Unlocks</div>
        {outgoing.length === 0 && <div className="mini-empty">Nothing depends on this yet</div>}
        {outgoing.map((n, i) => (
          <div className="mini-with-edge" key={i}>
            <span className="mini-edge-label">{(state.artifacts[n.art] || {}).name || n.art}</span>
            <NodeMini svc={n.svc} agId={n.svc.agency} />
          </div>
        ))}
      </div>
      {!hasNeighbors && <div className="mini-hint">Add required / produced documents to see how this service connects.</div>}
    </div>
  );
}
