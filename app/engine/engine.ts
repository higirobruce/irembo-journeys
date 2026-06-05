/* ============================================================================
   Irembo Journey Companion — engine (TypeScript port of design-engine.js)
   Pure, framework-free. Profile/conditions, active-step filtering, dependency
   edges, LR layered layout (Sugiyama-lite), status, rollups, warnings.
   Operates on the CANONICAL dataset shape (app/data/schema.json).
   Usage:  const E = createEngine(dataset); E.layout("open-restaurant", answers);
   ============================================================================ */
import type {
  Dataset, Service, Profile, Condition, ActiveStep, Edge, EdgePath,
  LayoutNode, LayoutOpts, LayoutResult, Rollup, Warning,
} from "./types.ts";

export function createEngine(dataset: Dataset) {
  const SERVICES: Record<string, Service> = {};
  dataset.services.forEach((s) => (SERVICES[s.id] = s));
  const ARTIFACTS: Record<string, { name: string; bring?: boolean }> = {};
  dataset.artifacts.forEach((a) => (ARTIFACTS[a.id] = a));
  const JOURNEYS: Record<string, Dataset["journeys"][number]> = {};
  dataset.journeys.forEach((j) => (JOURNEYS[j.id] = j));
  const QUESTIONS = dataset.questions || {};

  // ---- condition test ----------------------------------------------------
  function test(c: Condition | null | undefined, p: Profile): boolean {
    if (!c) return true;
    if (c.allOf) return c.allOf.every((x) => test(x, p));
    if (c.anyOf) return c.anyOf.some((x) => test(x, p));
    const v = p[c.v as string];
    switch (c.op) {
      case "eq": return v === c.val;
      case "neq": return v !== c.val;
      case "gte": return (v as number) >= (c.val as number);
      case "gt": return (v as number) > (c.val as number);
      case "lte": return (v as number) <= (c.val as number);
      case "lt": return (v as number) < (c.val as number);
      case "in": return ((c.val as unknown[]) || []).includes(v);
      case "exists": return v !== undefined;
      default: return true;
    }
  }

  // ---- build a profile from answers --------------------------------------
  function buildProfile(answers: Profile): Profile {
    const a = answers || {};
    const p: Profile = { applicantAge: 30 };
    Object.assign(p, a);
    p.legalStructure = (a.legalStructure as string) || "enterprise";
    p.annualTurnoverRWF = a.turnoverHigh ? 25000000 : 8000000;
    return p;
  }

  // ---- which steps apply given the profile -------------------------------
  function activeSteps(journeyId: string, answers: Profile): ActiveStep[] {
    const seeded: Profile = {};
    (QUESTIONS[journeyId] || []).forEach((q) => { seeded[q.key] = q.def; });
    Object.assign(seeded, answers || {});
    const p = buildProfile(seeded);
    return JOURNEYS[journeyId].steps
      .map((st) => ({ id: st.service, svc: SERVICES[st.service] }))
      .filter(({ svc }) => svc && test(svc.appliesWhen, p));
  }

  function producerOf(artId: string, active: ActiveStep[]): string | null {
    const s = active.find(({ svc }) => svc.produces.includes(artId));
    return s ? s.id : null;
  }

  // ---- dependency edges: A -> B if B requires an artifact A produces ------
  function buildEdges(active: ActiveStep[]): Edge[] {
    const ids = new Set(active.map((n) => n.id));
    const edges: Edge[] = [];
    const seen = new Set<string>();
    active.forEach(({ id, svc }) => {
      svc.requires.forEach((art) => {
        const prod = producerOf(art, active);
        if (prod && ids.has(prod) && prod !== id) {
          const key = prod + "->" + id;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: prod, to: id, art }); }
        }
      });
    });
    return edges;
  }

  // ---- longest-path layering (columns) -----------------------------------
  function layer(active: ActiveStep[], edges: Edge[]) {
    const preds: Record<string, string[]> = {}, succs: Record<string, string[]> = {};
    active.forEach(({ id }) => { preds[id] = []; succs[id] = []; });
    edges.forEach((e) => { preds[e.to].push(e.from); succs[e.from].push(e.to); });

    const depth: Record<string, number> = {};
    function d(id: string, stack: Set<string>): number {
      if (depth[id] !== undefined) return depth[id];
      if (stack.has(id)) return 0; // cycle guard
      stack.add(id);
      const ps = preds[id];
      depth[id] = ps.length ? Math.max(...ps.map((p) => d(p, stack) + 1)) : 0;
      stack.delete(id);
      return depth[id];
    }
    active.forEach(({ id }) => d(id, new Set()));
    return { depth, preds, succs };
  }

  // ---- order nodes within columns to reduce crossings --------------------
  function order(active: ActiveStep[], depth: Record<string, number>, preds: Record<string, string[]>, succs: Record<string, string[]>) {
    const cols: Record<number, { id: string; i: number }[]> = {};
    active.forEach(({ id }, i) => {
      const c = depth[id];
      (cols[c] = cols[c] || []).push({ id, i });
    });
    const maxC = Math.max(0, ...Object.keys(cols).map(Number));
    const pos: Record<string, number> = {};
    for (let c = 0; c <= maxC; c++) {
      (cols[c] || []).sort((a, b) => a.i - b.i);
      (cols[c] || []).forEach((n, r) => (pos[n.id] = r));
    }
    const median = (arr: number[]) => {
      if (!arr.length) return -1;
      const s = arr.slice().sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    for (let sweep = 0; sweep < 4; sweep++) {
      const down = sweep % 2 === 0;
      const range = down ? [...Array(maxC + 1).keys()] : [...Array(maxC + 1).keys()].reverse();
      range.forEach((c) => {
        const list = cols[c] || [];
        const ref = list.map((n) => {
          const neigh = down ? preds[n.id] : succs[n.id];
          const med = median(neigh.map((x) => pos[x]).filter((x) => x >= 0));
          return { id: n.id, key: med < 0 ? pos[n.id] : med };
        });
        ref.sort((a, b) => a.key - b.key);
        ref.forEach((n, r) => (pos[n.id] = r));
        cols[c] = ref.map((n) => ({ id: n.id, i: 0 }));
      });
    }
    return { cols, maxC, pos };
  }

  // ---- full layout: positions + edge bezier paths ------------------------
  function layout(journeyId: string, answers: Profile, opts?: LayoutOpts): LayoutResult {
    opts = opts || {};
    const density = opts.density || "regular";
    const variant = opts.variant || "cards";
    const base = {
      compact: { w: 188, gx: 80, gy: 16, pad: 30 },
      regular: { w: 230, gx: 104, gy: 22, pad: 40 },
      comfy:   { w: 262, gx: 132, gy: 28, pad: 52 },
    }[density];
    const heights = {
      cards:   { compact: 124, regular: 138, comfy: 152 },
      compact: { compact: 62,  regular: 72,  comfy: 84 },
      transit: { compact: 64,  regular: 74,  comfy: 86 },
    }[variant][density];
    const dim = { ...base, h: heights };

    let active = activeSteps(journeyId, answers);
    if (opts.hideHidden) active = active.filter(({ svc }) => !svc.hidden);

    const edges = buildEdges(active);
    const { depth, preds, succs } = layer(active, edges);
    const { cols, maxC, pos } = order(active, depth, preds, succs);

    const colCount: Record<number, number> = {};
    for (let c = 0; c <= maxC; c++) colCount[c] = (cols[c] || []).length;
    const maxRows = Math.max(1, ...Object.values(colCount));
    const fullH = maxRows * dim.h + (maxRows - 1) * dim.gy;

    const nodePos: Record<string, { x: number; y: number; col: number; row: number }> = {};
    for (let c = 0; c <= maxC; c++) {
      const list = cols[c] || [];
      const n = list.length;
      const colH = n * dim.h + (n - 1) * dim.gy;
      const top = dim.pad + (fullH - colH) / 2;
      list.forEach((node, r) => {
        nodePos[node.id] = { x: dim.pad + c * (dim.w + dim.gx), y: top + r * (dim.h + dim.gy), col: c, row: r };
      });
    }

    const width = dim.pad * 2 + (maxC + 1) * dim.w + maxC * dim.gx;
    const height = dim.pad * 2 + fullH;

    const edgePaths: EdgePath[] = edges.map((e) => {
      const a = nodePos[e.from], b = nodePos[e.to];
      const x1 = a.x + dim.w, y1 = a.y + dim.h / 2;
      const x2 = b.x,         y2 = b.y + dim.h / 2;
      const dx = Math.max(40, (x2 - x1) * 0.5);
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return { ...e, path, x1, y1, x2, y2 };
    });

    const nodes: LayoutNode[] = active.map(({ id, svc }) => ({
      id, svc, ...nodePos[id], depth: depth[id], preds: preds[id], succs: succs[id], order: 0,
    }));
    nodes.slice().sort((a, b) => (a.col - b.col) || (a.y - b.y)).forEach((n, i) => { n.order = i + 1; });

    return { nodes, edges: edgePaths, width, height, dim, maxC, density };
  }

  // ---- status of a node given a 'done' set -------------------------------
  function status(node: LayoutNode, doneSet: Set<string>): "done" | "ready" | "locked" {
    if (doneSet.has(node.id)) return "done";
    const blocked = node.preds.some((p) => !doneSet.has(p));
    return blocked ? "locked" : "ready";
  }

  function missingFor(node: LayoutNode, _active: ActiveStep[], doneSet: Set<string>): string[] {
    return node.preds.filter((p) => !doneSet.has(p)).map((p) => SERVICES[p].short || SERVICES[p].name);
  }

  // ---- duration / cost rollups -------------------------------------------
  const toDays: Record<string, number> = { min: 1 / 1440, hour: 1 / 24, day: 1, instant: 0, week: 7 };
  function fmtDur(s: Service): string {
    const du = s.duration.unit, dmin = s.duration.min ?? 0, dmax = s.duration.max ?? 0;
    if (du === "instant") return "Instant";
    const u = du === "min" ? "min" : du === "hour" ? "hr" : du === "week" ? "wk" : "days";
    return dmin === dmax ? `${dmax} ${u}` : `${dmin}–${dmax} ${u}`;
  }
  function fmtDurFriendly(s: Service): string {
    const du = s.duration.unit, d = s.duration.max ?? 0;
    if (du === "instant") return "Instant";
    if (du === "min") return d <= 60 ? "A few minutes" : "Under an hour";
    if (du === "hour") return "A few hours";
    if (du === "week") return d <= 1 ? "About a week" : `${d} weeks`;
    if (d <= 1) return "Same day";
    if (d <= 3) return "1–3 days";
    if (d <= 7) return "About a week";
    if (d <= 14) return "1–2 weeks";
    if (d <= 30) return "A few weeks";
    return "A month or more";
  }
  function rollup(nodes: LayoutNode[], _edges: EdgePath[]): Rollup {
    let hidden = 0, fees = false;
    nodes.forEach((n) => { if (n.svc.hidden) hidden++; if (n.svc.cost.model !== "free") fees = true; });
    const byId: Record<string, LayoutNode> = {}; nodes.forEach((n) => (byId[n.id] = n));
    const memoLo: Record<string, number> = {}, memoHi: Record<string, number> = {};
    function dur(id: string, memo: Record<string, number>, key: "min" | "max"): number {
      if (memo[id] !== undefined) return memo[id];
      const n = byId[id];
      const self = (n.svc.duration[key] || 0) * (toDays[n.svc.duration.unit] || 0);
      const succ = n.succs.filter((s) => byId[s]);
      memo[id] = self + (succ.length ? Math.max(...succ.map((s) => dur(s, memo, key))) : 0);
      return memo[id];
    }
    const roots = nodes.filter((n) => n.preds.length === 0).map((n) => n.id);
    const lo = roots.length ? Math.max(...roots.map((r) => dur(r, memoLo, "min"))) : 0;
    const hi = roots.length ? Math.max(...roots.map((r) => dur(r, memoHi, "max"))) : 0;
    return { steps: nodes.length, hidden, lo: Math.round(lo), hi: Math.round(hi), fees };
  }

  function warnings(nodes: LayoutNode[], answers: Profile): Warning[] {
    const p = buildProfile(answers);
    const out: Warning[] = [];
    nodes.forEach((n) => (n.svc.rules || []).forEach((r) => {
      if (test(r.when, p) && (r.severity === "high" || ["rejection", "illegal-operation", "silent-liability"].includes(r.failureMode))) {
        out.push({ sev: r.severity, msg: r.message, tip: r.mitigation, step: n.svc.short || n.svc.name, stepId: n.id });
      }
    }));
    return out;
  }

  function bringList(nodes: LayoutNode[]): string[] {
    const set = new Set<string>();
    nodes.forEach((n) => n.svc.requires.forEach((a) => { if (ARTIFACTS[a] && ARTIFACTS[a].bring) set.add(a); }));
    return [...set].map((a) => ARTIFACTS[a].name);
  }

  function matchGoal(text: string): string | null {
    const t = (text || "").toLowerCase();
    if (!t) return null;
    for (const j of dataset.journeys) {
      if ((j.goalPhrases || []).some((m) => t.includes(m))) return j.id;
    }
    return null;
  }

  return {
    test, buildProfile, activeSteps, buildEdges, layout, status, missingFor,
    fmtDur, fmtDurFriendly, rollup, warnings, bringList, matchGoal, producerOf,
  };
}
