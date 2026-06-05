"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { LayoutResult, LayoutNode, Agency } from "@engine/types";
import { ENGINE, AGENCIES } from "@/lib/data";
import { useLocale } from "@/lib/i18n";
import { darken } from "@/lib/colors";
import { AgencyIcons } from "./icons";

export type Filter = { type: "none" } | { type: "hidden" } | { type: "fees" } | { type: "agency"; value: string };

interface Props {
  layout: LayoutResult;
  variant: string;
  progress: boolean;
  done: Set<string>;
  selected: string | null;
  filter: Filter;
  onSelect: (id: string) => void;
  onToggleDone: (id: string) => void;
  journeyGoal?: string;
}

function statusOf(n: LayoutNode, done: Set<string>): "done" | "ready" | "locked" {
  if (done.has(n.id)) return "done";
  return n.preds.some((p) => !done.has(p)) ? "locked" : "ready";
}

export function GraphCanvas(props: Props) {
  const { layout, variant, progress, done, selected, filter, onSelect, onToggleDone, journeyGoal } = props;
  const { nodes, edges, width, height } = layout;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });
  const [hovered, setHovered] = useState<string | null>(null);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const fit = useCallback(() => {
    const el = wrapRef.current; if (!el) return;
    const vw = el.clientWidth, vh = el.clientHeight, pad = 56;
    const s = Math.min(1.1, (vw - pad * 2) / width, (vh - pad * 2) / height);
    const scale = Math.max(0.35, s);
    setView({ x: (vw - width * scale) / 2, y: (vh - height * scale) / 2, scale });
  }, [width, height]);
  useEffect(() => { fit(); }, [fit]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const scale = Math.min(2.2, Math.max(0.3, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: mx - (mx - v.x) * k, y: my - (my - v.y) * k };
    });
  };
  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".node")) return;
    pan.current = { sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    wrapRef.current?.classList.add("panning");
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!pan.current) return;
      const p = pan.current;
      setView((v) => ({ ...v, x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) }));
    };
    const onUp = () => { pan.current = null; wrapRef.current?.classList.remove("panning"); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const byId = useMemo(() => { const m: Record<string, LayoutNode> = {}; nodes.forEach((n) => (m[n.id] = n)); return m; }, [nodes]);

  const focusId = hovered || selected;
  const chain = useMemo(() => {
    if (!focusId || !byId[focusId]) return null;
    const set = new Set<string>([focusId]);
    const up = (id: string) => byId[id]?.preds.forEach((p) => { if (!set.has(p)) { set.add(p); up(p); } });
    const dn = (id: string) => byId[id]?.succs.forEach((s) => { if (!set.has(s)) { set.add(s); dn(s); } });
    up(focusId); dn(focusId);
    return set;
  }, [focusId, byId]);

  const matches = useCallback((n: LayoutNode) => {
    if (!filter || filter.type === "none") return true;
    if (filter.type === "hidden") return !!n.svc.hidden;
    if (filter.type === "fees") return n.svc.cost.model !== "free";
    if (filter.type === "agency") return n.svc.agency === filter.value;
    return true;
  }, [filter]);

  const dimmed = useCallback((n: LayoutNode) => {
    if (filter && filter.type !== "none" && !matches(n)) return true;
    if (chain && !chain.has(n.id)) return true;
    return false;
  }, [filter, matches, chain]);

  return (
    <div className="graph-wrap" ref={wrapRef} data-variant={variant} onWheel={onWheel} onMouseDown={onDown}>
      <div className="graph-viewport" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`, width, height }}>
        <svg className="graph-svg" width={width} height={height}>
          {edges.map((e, i) => {
            const a = byId[e.from], b = byId[e.to];
            const flowDone = progress && done.has(e.from);
            const inChain = chain && chain.has(e.from) && chain.has(e.to);
            const isDim = (chain && !inChain) || (filter && filter.type !== "none" && (dimmed(a) || dimmed(b)));
            const cls = ["edge", flowDone ? "flow-done" : "", inChain ? "hl" : "", isDim ? "dim" : ""].join(" ");
            return <path key={i} className={cls} d={e.path} />;
          })}
        </svg>
        {nodes.map((n) => (
          <NodeCard key={n.id} n={n} variant={variant} dim={layout.dim}
            agency={AGENCIES[n.svc.agency]} progress={progress}
            status={progress ? statusOf(n, done) : "plain"}
            isGoal={!!journeyGoal && n.svc.produces.includes(journeyGoal)}
            dimmed={dimmed(n)} selected={selected === n.id}
            onSelect={() => onSelect(n.id)} onHover={setHovered}
            onToggleDone={() => onToggleDone(n.id)} />
        ))}
      </div>
      <div className="graph-controls">
        <button onClick={() => setView((v) => ({ ...v, scale: Math.min(2.2, v.scale * 1.15) }))} title="Zoom in">+</button>
        <button onClick={() => setView((v) => ({ ...v, scale: Math.max(0.3, v.scale / 1.15) }))} title="Zoom out">−</button>
        <button onClick={fit} title="Fit to screen" style={{ fontSize: ".82rem" }}>⤢</button>
      </div>
      <div className="minimap-hint">drag to pan · scroll to zoom · {nodes.length} steps</div>
    </div>
  );
}

interface NodeProps {
  n: LayoutNode; variant: string; dim: LayoutResult["dim"]; agency: Agency; progress: boolean;
  status: string; isGoal: boolean; dimmed: boolean; selected: boolean;
  onSelect: () => void; onHover: (id: string | null) => void; onToggleDone: () => void;
}

function NodeCard({ n, variant, dim, agency, progress, status, isGoal, dimmed, selected, onSelect, onHover, onToggleDone }: NodeProps) {
  const { t } = useLocale();
  const svc = n.svc;
  const cls = ["node", `v-${variant}`, dimmed ? "dim" : "", selected ? "selected" : "", isGoal ? "is-goal" : "", progress ? `is-${status}` : ""].join(" ");
  const style = {
    left: n.x, top: n.y, width: dim.w, height: dim.h,
    ["--ag-color" as string]: agency.color,
    ["--ag-dark" as string]: agency.color ? darken(agency.color, 0.18) : agency.color,
  } as React.CSSProperties;
  const name = t(`service.${svc.id}.short`, svc.short || svc.name);
  const durChip = ENGINE.fmtDurFriendly(svc);
  const where = t(`agency.${svc.agency}.where`, agency.where || "");
  const agIcon = AgencyIcons[svc.agency];
  const isFree = svc.cost.model === "free";
  const handleBadge = (e: React.MouseEvent) => { if (progress) { e.stopPropagation(); onToggleDone(); } };

  return (
    <div className={cls} style={style} onClick={onSelect}
      onMouseEnter={() => onHover(n.id)} onMouseLeave={() => onHover(null)}>
      {svc.hidden && <div className="hidden-dot" title="Easy to forget — many people miss this">!</div>}
      {progress && (
        <div className={`status-badge ${status}`} onClick={handleBadge}
          title={status === "done" ? "Done — click to undo" : status === "ready" ? "Do this next — click when done" : "Comes later — finish earlier steps first"}>
          {status === "done" ? "✓" : status === "locked" ? "🔒" : ""}
        </div>
      )}
      <div className="card">
        {variant === "cards" && (
          <>
            <div className="top">
              <span className="ag-ico" style={{ background: agency.color }}>{agIcon}</span>
              <div className="top-txt">
                <span className="step-n">Step {n.order}</span>
                <span className="nm">{name}</span>
              </div>
            </div>
            <div className="meta">
              <span className="where-pill"><span className="wdot" style={{ background: agency.color }} />{where}</span>
            </div>
            <div className="meta">
              <span className="time-pill">🕑 {durChip}</span>
              <span className={`chip ${isFree ? "free" : "fee"}`}>{isFree ? "Free" : "Has a fee"}</span>
              {svc.hidden && <span className="chip hidden">easy to forget</span>}
            </div>
          </>
        )}
        {variant === "compact" && (
          <>
            <span className="ag-ico sm" style={{ background: agency.color }}>{agIcon}</span>
            <div className="cmp-txt">
              <span className="step-n">Step {n.order}</span>
              <span className="nm">{name}</span>
            </div>
          </>
        )}
        {variant === "transit" && (
          <>
            <span className="station">{n.order}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="nm">{name}</span>
              <span className="dur">{where} · {durChip}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
