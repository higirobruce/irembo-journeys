"use client";
import { useState } from "react";
import type { AdminState } from "@/lib/adminStore";
import type { Agency } from "@engine/types";
import { JourneyIcons } from "@/components/icons";

export function JourneysView({ state, agencies, onSave }: {
  state: AdminState; agencies: Record<string, Agency>; onSave: (id: string, steps: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const startEdit = (id: string, current: string[]) => { setEditing(id); setSteps([...current]); };
  const move = (i: number, dir: number) => { const n = [...steps]; const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setSteps(n); };
  const remove = (i: number) => setSteps(steps.filter((_, k) => k !== i));
  const add = (id: string) => { if (id && !steps.includes(id)) setSteps([...steps, id]); };
  async function save(id: string) { setBusy(true); try { await onSave(id, steps); setEditing(null); } finally { setBusy(false); } }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14 }}>
      {Object.values(state.journeys).map((j) => {
        const isEditing = editing === j.id;
        const stepIds = isEditing ? steps : j.steps.filter((sid) => state.services[sid]);
        const live = j.steps.filter((sid) => state.services[sid]?._meta.status === "published").length;
        const notInPath = Object.values(state.services).filter((s) => !stepIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
        return (
          <div key={j.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <span className="svc-ico" style={{ background: "var(--brand)", width: 36, height: 36 }}>{j.icon ? JourneyIcons[j.icon] : null}</span>
              <div style={{ flex: 1 }}><b style={{ fontSize: ".98rem" }}>{j.name}</b><div style={{ fontSize: ".78rem", color: "var(--faint)" }}>{j.steps.length} steps · {live} live</div></div>
              {!isEditing && <button className="btn outline sm" onClick={() => startEdit(j.id, j.steps)}>Edit path</button>}
            </div>

            {!isEditing && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {stepIds.map((sid) => {
                  const s = state.services[sid]; const ag = s ? agencies[s.agency] || ({} as Agency) : ({} as Agency);
                  return (
                    <span key={sid} title={s?.name} style={{ fontSize: ".72rem", fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--soft)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <i style={{ width: 7, height: 7, borderRadius: "50%", background: ag.color }} />{s?.short || sid}
                    </span>
                  );
                })}
              </div>
            )}

            {isEditing && (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {stepIds.map((sid, i) => {
                    const s = state.services[sid]; const ag = s ? agencies[s.agency] || ({} as Agency) : ({} as Agency);
                    return (
                      <div key={sid} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "6px 9px" }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: ".7rem", color: "var(--faint)", width: 18 }}>{i + 1}</span>
                        <i style={{ width: 8, height: 8, borderRadius: "50%", background: ag.color, flex: "0 0 auto" }} />
                        <span style={{ flex: 1, fontSize: ".82rem", fontWeight: 600 }}>{s?.short || sid}</span>
                        <button title="Up" className="jbtn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                        <button title="Down" className="jbtn" onClick={() => move(i, 1)} disabled={i === stepIds.length - 1}>↓</button>
                        <button title="Remove" className="jbtn danger" onClick={() => remove(i)}>✕</button>
                      </div>
                    );
                  })}
                  {stepIds.length === 0 && <div style={{ fontSize: ".82rem", color: "var(--faint)", padding: "6px 0" }}>No steps yet — add services below.</div>}
                </div>
                <select value="" onChange={(e) => add(e.target.value)} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "8px 10px", font: "inherit", background: "var(--paper)", color: "var(--ink)", marginBottom: 12 }}>
                  <option value="">+ add a service to the path…</option>
                  {notInPath.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn ghost sm" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                  <span style={{ flex: 1 }} />
                  <button className="btn primary sm" onClick={() => save(j.id)} disabled={busy}>{busy ? "Saving…" : "Save path"}</button>
                </div>
                <div style={{ fontSize: ".72rem", color: "var(--faint)", marginTop: 8 }}>Saving changes the live citizen path (publisher only).</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
