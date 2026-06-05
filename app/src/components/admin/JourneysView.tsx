"use client";
import type { AdminState } from "@/lib/adminStore";
import type { Agency } from "@engine/types";
import { JourneyIcons } from "@/components/icons";

export function JourneysView({ state, agencies }: { state: AdminState; agencies: Record<string, Agency> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
      {Object.values(state.journeys).map((j) => {
        const steps = j.steps.filter((sid) => state.services[sid]);
        const live = steps.filter((sid) => state.services[sid]._meta.status === "published").length;
        return (
          <div key={j.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              <span className="svc-ico" style={{ background: "var(--brand)", width: 36, height: 36 }}>{j.icon ? JourneyIcons[j.icon] : null}</span>
              <div><b style={{ fontSize: ".98rem" }}>{j.name}</b><div style={{ fontSize: ".78rem", color: "var(--faint)" }}>{steps.length} steps · {live} live</div></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {steps.map((sid) => {
                const s = state.services[sid]; const ag = agencies[s.agency] || ({} as Agency);
                return (
                  <span key={sid} title={s.name} style={{ fontSize: ".72rem", fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--line)", color: "var(--soft)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <i style={{ width: 7, height: 7, borderRadius: "50%", background: ag.color }} />{s.short}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ display: "grid", placeItems: "center", border: "2px dashed var(--line)", borderRadius: "var(--r-lg)", padding: 18, color: "var(--faint)", fontSize: ".85rem", minHeight: 120, textAlign: "center" }}>
        Journey assembly editor<br /><span style={{ fontSize: ".76rem" }}>(drag services into a path — next iteration)</span>
      </div>
    </div>
  );
}
