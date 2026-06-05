"use client";
import type { Journey, Agency } from "@engine/types";
import type { Rollup } from "@engine/types";
import { useLocale } from "@/lib/i18n";
import type { Filter } from "./GraphCanvas";

interface Props {
  journey: Journey; rollup: Rollup; progress: boolean; onToggleProgress: () => void;
  filter: Filter; setFilter: (f: Filter) => void;
  agencies: Record<string, Agency>; usedAgencies: string[]; doneCount: number; onEdit: () => void;
}

export function JourneyBar({ journey, rollup, progress, onToggleProgress, filter, setFilter, agencies, usedAgencies, doneCount, onEdit }: Props) {
  const { t } = useLocale();
  const pct = progress && rollup.steps ? Math.round((doneCount / rollup.steps) * 100) : 0;
  return (
    <div className="jbar">
      <div className="jbar-top">
        <button className="edit-link" onClick={onEdit} title="Change your answers">←</button>
        <div className="jbar-title">{t(`journey.${journey.id}.name`, journey.name)}
          <small>Personalized to your answers · {progress ? `${doneCount}/${rollup.steps} done (${pct}%)` : "tap any step for details"}</small>
        </div>
        <div className="stats">
          <div className="stat"><div className="big a">{rollup.steps}</div><div className="lab">Steps</div></div>
          <div className="stat"><div className="big v">{rollup.hidden}</div><div className="lab">Easy to forget</div></div>
          <div className="stat"><div className="big">~{rollup.lo}–{rollup.hi}</div><div className="lab">Days</div></div>
          <div className="stat"><div className="big">{rollup.fees ? "Some" : "Free"}</div><div className="lab">{rollup.fees ? "fees" : "no fees"}</div></div>
        </div>
        <div className="spacer" />
        <div className={`prog-toggle ${progress ? "on" : ""}`} onClick={onToggleProgress}>
          <span className="switch" /> Track my progress
        </div>
      </div>

      <div className="jbar-bottom">
        <div className="filters">
          <span className="flabel">Show me</span>
          <button className={`fchip ${filter.type === "none" ? "on" : ""}`} onClick={() => setFilter({ type: "none" })}>Everything</button>
          <button className={`fchip violet ${filter.type === "hidden" ? "on" : ""}`} onClick={() => setFilter({ type: "hidden" })}>! Easy to forget</button>
          <button className={`fchip ${filter.type === "fees" ? "on" : ""}`} onClick={() => setFilter({ type: "fees" })}>Costs money</button>
          <select className="fselect" value={filter.type === "agency" ? filter.value : ""}
            onChange={(e) => setFilter(e.target.value ? { type: "agency", value: e.target.value } : { type: "none" })}>
            <option value="">Where I do it…</option>
            {usedAgencies.map((a) => <option key={a} value={a}>{t(`agency.${a}.name`, agencies[a].name)}</option>)}
          </select>
        </div>
        <div className="legend">
          {progress ? (
            <>
              <span><i style={{ background: "var(--green)" }} />Done</span>
              <span><i style={{ background: "var(--brand)" }} />Do next</span>
              <span><i className="dashed" />Comes later</span>
              <span><i style={{ background: "var(--violet)" }} />Easy to forget</span>
            </>
          ) : (
            <span style={{ color: "var(--faint)" }}>Lines show what you finish before each step · ! = people often forget this one</span>
          )}
        </div>
      </div>
    </div>
  );
}
