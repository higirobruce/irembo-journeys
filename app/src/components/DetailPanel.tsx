"use client";
import type { LayoutNode, Agency } from "@engine/types";
import { ENGINE, ARTIFACTS } from "@/lib/data";
import { useLocale } from "@/lib/i18n";

interface Props {
  node: LayoutNode; agencies: Record<string, Agency>; allNodes: LayoutNode[];
  done: Set<string>; progress: boolean; onClose: () => void; onToggleDone: (id: string) => void;
}

export function DetailPanel({ node, agencies, allNodes, done, progress, onClose, onToggleDone }: Props) {
  const { t } = useLocale();
  if (!node) return null;
  const svc = node.svc;
  const ag = agencies[svc.agency];
  const isDone = done.has(node.id);

  const nameOf = (id: string) => {
    const dn = allNodes.find((x) => x.id === id);
    return dn ? t(`service.${dn.svc.id}.short`, dn.svc.short || dn.svc.name) : id;
  };
  const deps = node.preds.map((pid) => ({ id: pid, name: nameOf(pid), done: done.has(pid) }));
  const unlocks = node.succs.map((sid) => nameOf(sid));
  const brings = svc.requires
    .filter((a) => ARTIFACTS[a] && ARTIFACTS[a].bring)
    .map((a) => t(`artifact.${a}.name`, ARTIFACTS[a].name));
  const isFree = svc.cost.model === "free";

  return (
    <>
      <div className="detail-scrim" onClick={onClose} />
      <div className="detail">
        <div className="detail-head">
          <button className="detail-close" onClick={onClose}>✕</button>
          <div className="ag-line">
            <span className="ag-dot" style={{ background: ag.color }} />
            <span className="ag-name">{t(`agency.${svc.agency}.where`, ag.where || "")}</span>
            {svc.hidden && <span className="chip hidden">easy to forget</span>}
          </div>
          <h2>{t(`service.${svc.id}.name`, svc.name)}</h2>
          <div className="detail-meta">
            <div className="mpill"><span className="mk">Cost</span><span className="mv" style={{ color: isFree ? "var(--green)" : "var(--amber)" }}>{isFree ? "Free" : "Has a fee"}</span></div>
            <div className="mpill"><span className="mk">How long</span><span className="mv">{ENGINE.fmtDurFriendly(svc)}</span></div>
          </div>
        </div>

        <div className="detail-body">
          <p className="desc">{t(`service.${svc.id}.desc`, svc.desc || "")}</p>

          {deps.length > 0 && (
            <>
              <h4>You need to finish first</h4>
              {deps.map((d) => (
                <div className="dep-item" key={d.id}>
                  <span className={`pin ${d.done ? "ok" : "todo"}`}>{d.done ? "✓" : ""}</span>
                  {d.name}{progress && !d.done && <span style={{ color: "var(--faint)", fontSize: ".78rem" }}> — not done yet</span>}
                </div>
              ))}
            </>
          )}

          {brings.length > 0 && (
            <>
              <h4>Bring / arrange yourself</h4>
              {brings.map((b, i) => <div className="bring-item" key={i}>{b}</div>)}
            </>
          )}

          {svc.rules && svc.rules.length > 0 && (
            <>
              <h4>Good to know</h4>
              {svc.rules.map((r, i) => (
                <div className={`rule ${r.severity === "high" ? "high" : "med"}`} key={i}>
                  <span className="ric">{r.severity === "high" ? "⚠" : "!"}</span>
                  <div>{r.message}{r.mitigation && <span className="rtip">→ {r.mitigation}</span>}</div>
                </div>
              ))}
            </>
          )}

          {unlocks.length > 0 && (
            <>
              <h4>This opens up</h4>
              <div style={{ fontSize: ".88rem", color: "var(--soft)" }}>{unlocks.join(" · ")}</div>
            </>
          )}
        </div>

        {progress && (
          <div className="detail-foot">
            <button className={`btn ${isDone ? "undo-btn" : "done-btn"}`} onClick={() => onToggleDone(node.id)}>
              {isDone ? "↩ Mark as not done" : "✓ Mark this step done"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
