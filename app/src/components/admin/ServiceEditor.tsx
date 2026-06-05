"use client";
import { useState } from "react";
import type { AdminState, AdminService } from "@/lib/adminStore";
import type { Agency } from "@engine/types";
import { MiniGraph } from "./MiniGraph";

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 };
const labelS: React.CSSProperties = { fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)", fontWeight: 800 };
const inputS: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "9px 11px", font: "inherit", background: "var(--paper)", color: "var(--ink)" };

function emptyDraft(): AdminService {
  return { id: "", name: "", short: "", agency: "self", desc: "", requires: [], produces: [],
    cost: { model: "free" }, duration: { min: 1, max: 1, unit: "day" }, hidden: false, rules: [],
    _meta: { status: "draft", source: "manual" } };
}

export function ServiceEditor({ state, agencies, editId, onCancel, onSave }: {
  state: AdminState; agencies: Record<string, Agency>; editId: string | null;
  onCancel: () => void; onSave: (d: AdminService, action: "draft" | "publish") => void;
}) {
  const [d, setD] = useState<AdminService>(() => editId ? JSON.parse(JSON.stringify(state.services[editId])) : emptyDraft());
  const set = (patch: Partial<AdminService>) => setD((p) => ({ ...p, ...patch }));
  const artifacts = Object.entries(state.artifacts);

  const Chips = ({ list, onRemove }: { list: string[]; onRemove: (a: string) => void }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
      {list.length === 0 && <span style={{ color: "var(--faint)", fontSize: ".82rem" }}>none</span>}
      {list.map((a) => (
        <span key={a} style={{ fontSize: ".74rem", fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--line)", display: "inline-flex", gap: 6, alignItems: "center" }}>
          {(state.artifacts[a] || {}).name || a}
          <button onClick={() => onRemove(a)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--faint)" }}>✕</button>
        </span>
      ))}
    </div>
  );
  const addArt = (key: "requires" | "produces", a: string) => { if (a && !d[key].includes(a)) set({ [key]: [...d[key], a] } as Partial<AdminService>); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 22, alignItems: "start" }}>
      <div>
        <div style={field}><label style={labelS}>Service name</label>
          <input style={inputS} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Construction permit" /></div>
        <div style={field}><label style={labelS}>Short label (on the node)</label>
          <input style={inputS} value={d.short || ""} onChange={(e) => set({ short: e.target.value })} placeholder="e.g. Building permit" /></div>
        <div style={field}><label style={labelS}>Handled by</label>
          <select style={inputS} value={d.agency} onChange={(e) => set({ agency: e.target.value })}>
            {Object.values(agencies).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...field, flex: 1 }}><label style={labelS}>Cost</label>
            <select style={inputS} value={d.cost.model} onChange={(e) => set({ cost: { model: e.target.value } })}>
              <option value="free">Free</option><option value="fee">Has a fee</option>
            </select></div>
          <div style={{ ...field, flex: 1 }}><label style={labelS}>Time unit</label>
            <select style={inputS} value={d.duration.unit} onChange={(e) => set({ duration: { ...d.duration, unit: e.target.value as typeof d.duration.unit } })}>
              {["instant", "min", "hour", "day", "week"].map((u) => <option key={u} value={u}>{u}</option>)}
            </select></div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ ...field, flex: 1 }}><label style={labelS}>Min</label>
            <input type="number" style={inputS} value={d.duration.min ?? 0} onChange={(e) => set({ duration: { ...d.duration, min: +e.target.value } })} /></div>
          <div style={{ ...field, flex: 1 }}><label style={labelS}>Max</label>
            <input type="number" style={inputS} value={d.duration.max ?? 0} onChange={(e) => set({ duration: { ...d.duration, max: +e.target.value } })} /></div>
        </div>
        <div style={field}><label style={labelS}>Description</label>
          <textarea style={{ ...inputS, minHeight: 70, resize: "vertical" }} value={d.desc || ""} onChange={(e) => set({ desc: e.target.value })} /></div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: ".86rem", marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={!!d.hidden} onChange={(e) => set({ hidden: e.target.checked })} /> Easy to forget (hidden step)
        </label>

        <div style={field}><label style={labelS}>Requires (documents needed)</label>
          <Chips list={d.requires} onRemove={(a) => set({ requires: d.requires.filter((x) => x !== a) })} />
          <select style={inputS} value="" onChange={(e) => addArt("requires", e.target.value)}>
            <option value="">+ add a required document…</option>
            {artifacts.map(([id, a]) => <option key={id} value={id}>{a.name}</option>)}
          </select></div>
        <div style={field}><label style={labelS}>Produces (documents issued)</label>
          <Chips list={d.produces} onRemove={(a) => set({ produces: d.produces.filter((x) => x !== a) })} />
          <select style={inputS} value="" onChange={(e) => addArt("produces", e.target.value)}>
            <option value="">+ add a produced document…</option>
            {artifacts.map(([id, a]) => <option key={id} value={id}>{a.name}</option>)}
          </select></div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <span style={{ flex: 1 }} />
          <button className="btn outline" onClick={() => onSave(d, "draft")} disabled={!d.name}>Save draft</button>
          <button className="btn primary" onClick={() => onSave(d, "publish")} disabled={!d.name}>Publish</button>
        </div>
      </div>

      <div style={{ position: "sticky", top: 0 }}>
        <div style={{ ...labelS, marginBottom: 10 }}>Live preview — how it connects</div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
          <MiniGraph state={state} draft={d} agencies={agencies} />
        </div>
      </div>
    </div>
  );
}
