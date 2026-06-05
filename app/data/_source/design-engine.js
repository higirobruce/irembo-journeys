/* ============================================================================
   Irembo Journey Companion — engine
   Profile, conditions, active-step filtering, dependency edges, LR layered
   layout (Sugiyama-lite), status, rollups & warnings.
   Exposed on window.ENGINE. Pure functions — no DOM.
   ============================================================================ */
(function () {
  const { SERVICES, JOURNEYS, QUESTIONS, ARTIFACTS } = window.DATA;

  // ---- condition test ------------------------------------------------------
  function test(c, p) {
    if (!c) return true;
    const v = p[c.v];
    switch (c.op) {
      case "eq":  return v === c.val;
      case "lt":  return v < c.val;
      case "gte": return v >= c.val;
      case "in":  return (c.val || []).includes(v);
      default:    return true;
    }
  }

  // ---- build a profile from answers ---------------------------------------
  function buildProfile(answers) {
    const a = answers || {};
    const p = { applicantAge: 30 };
    Object.assign(p, a);
    p.legalStructure = a.legalStructure || "enterprise";
    p.annualTurnoverRWF = a.turnoverHigh ? 25000000 : 8000000;
    return p;
  }

  // ---- which steps apply given the profile --------------------------------
  function activeSteps(journeyId, answers) {
    // seed every question's default so conditions never see `undefined`
    const seeded = {};
    (QUESTIONS[journeyId] || []).forEach((q) => { seeded[q.key] = q.def; });
    Object.assign(seeded, answers || {});
    const p = buildProfile(seeded);
    return JOURNEYS[journeyId].steps
      .map((id) => ({ id, svc: SERVICES[id] }))
      .filter(({ svc }) => test(svc.when, p));
  }

  // producing step of an artifact (within active set)
  function producerOf(artId, active) {
    const s = active.find(({ svc }) => svc.pro.includes(artId));
    return s ? s.id : null;
  }

  // ---- dependency edges: A -> B if B requires an artifact A produces -------
  function buildEdges(active) {
    const ids = new Set(active.map((n) => n.id));
    const edges = [];
    const seen = new Set();
    active.forEach(({ id, svc }) => {
      svc.req.forEach((art) => {
        const prod = producerOf(art, active);
        if (prod && ids.has(prod) && prod !== id) {
          const key = prod + "->" + id;
          if (!seen.has(key)) { seen.add(key); edges.push({ from: prod, to: id, art }); }
        }
      });
    });
    return edges;
  }

  // ---- longest-path layering (columns) ------------------------------------
  function layer(active, edges) {
    const preds = {}, succs = {};
    active.forEach(({ id }) => { preds[id] = []; succs[id] = []; });
    edges.forEach((e) => { preds[e.to].push(e.from); succs[e.from].push(e.to); });

    const depth = {};
    function d(id, stack) {
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

  // ---- order nodes within columns to reduce crossings ---------------------
  function order(active, depth, preds, succs) {
    const cols = {};
    active.forEach(({ id }, i) => {
      const c = depth[id];
      (cols[c] = cols[c] || []).push({ id, i });
    });
    const maxC = Math.max(0, ...Object.keys(cols).map(Number));
    // initial order: original sequence
    const pos = {};
    for (let c = 0; c <= maxC; c++) {
      (cols[c] || []).sort((a, b) => a.i - b.i);
      (cols[c] || []).forEach((n, r) => (pos[n.id] = r));
    }
    // median heuristic, a few sweeps forward & back
    const median = (arr) => {
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

  // ---- full layout: positions + edge bezier paths -------------------------
  // density: 'compact' | 'regular' | 'comfy'  affects node size + gaps
  function layout(journeyId, answers, opts) {
    opts = opts || {};
    const density = opts.density || "regular";
    const variant = opts.variant || "cards";
    const base = {
      compact: { w: 188, gx: 80, gy: 16, pad: 30 },
      regular: { w: 230, gx: 104, gy: 22, pad: 40 },
      comfy:   { w: 262, gx: 132, gy: 28, pad: 52 },
    }[density];
    // node height depends on how much each variant draws
    const heights = {
      cards:   { compact: 124, regular: 138, comfy: 152 },
      compact: { compact: 62,  regular: 72,  comfy: 84 },
      transit: { compact: 64,  regular: 74,  comfy: 86 },
    }[variant][density];
    const dim = { ...base, h: heights };

    let active = activeSteps(journeyId, answers);
    // optionally drop hidden steps entirely (naive "what people think" view)
    if (opts.hideHidden) active = active.filter(({ svc }) => !svc.hidden);

    const edges = buildEdges(active);
    const { depth, preds, succs } = layer(active, edges);
    const { cols, maxC, pos } = order(active, depth, preds, succs);

    // column heights to vertically center each column
    const colCount = {};
    for (let c = 0; c <= maxC; c++) colCount[c] = (cols[c] || []).length;
    const maxRows = Math.max(1, ...Object.values(colCount));
    const fullH = maxRows * dim.h + (maxRows - 1) * dim.gy;

    const nodePos = {};
    for (let c = 0; c <= maxC; c++) {
      const list = cols[c] || [];
      const n = list.length;
      const colH = n * dim.h + (n - 1) * dim.gy;
      const top = dim.pad + (fullH - colH) / 2;
      list.forEach((node, r) => {
        nodePos[node.id] = {
          x: dim.pad + c * (dim.w + dim.gx),
          y: top + r * (dim.h + dim.gy),
          col: c, row: r,
        };
      });
    }

    const width = dim.pad * 2 + (maxC + 1) * dim.w + maxC * dim.gx;
    const height = dim.pad * 2 + fullH;

    // edge paths (cubic bezier, right edge of A -> left edge of B)
    const edgePaths = edges.map((e) => {
      const a = nodePos[e.from], b = nodePos[e.to];
      const x1 = a.x + dim.w, y1 = a.y + dim.h / 2;
      const x2 = b.x,         y2 = b.y + dim.h / 2;
      const dx = Math.max(40, (x2 - x1) * 0.5);
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      return { ...e, path, x1, y1, x2, y2 };
    });

    const nodes = active.map(({ id, svc }) => ({
      id, svc, ...nodePos[id],
      depth: depth[id], preds: preds[id], succs: succs[id],
    }));
    // citizen-friendly step numbers, reading order: column then top-to-bottom
    nodes.slice().sort((a, b) => (a.col - b.col) || (a.y - b.y)).forEach((n, i) => { n.order = i + 1; });

    return { nodes, edges: edgePaths, width, height, dim, maxC, density };
  }

  // ---- status of a node given a 'done' set --------------------------------
  // returns: 'done' | 'ready' | 'locked'  (when progress mode on)
  function status(node, doneSet) {
    if (doneSet.has(node.id)) return "done";
    const blocked = node.preds.some((p) => !doneSet.has(p));
    return blocked ? "locked" : "ready";
  }

  function missingFor(node, active, doneSet) {
    return node.preds
      .filter((p) => !doneSet.has(p))
      .map((p) => SERVICES[p].short || SERVICES[p].name);
  }

  // ---- duration / cost rollups --------------------------------------------
  const toDays = { min: 1 / 1440, hour: 1 / 24, day: 1, instant: 0 };
  function fmtDur(s) {
    if (s.du === "instant") return "Instant";
    const u = s.du === "min" ? "min" : s.du === "hour" ? "hr" : "days";
    return s.dmin === s.dmax ? `${s.dmax} ${u}` : `${s.dmin}–${s.dmax} ${u}`;
  }
  // plain-language time for citizens
  function fmtDurFriendly(s) {
    if (s.du === "instant") return "Instant";
    if (s.du === "min") return s.dmax <= 60 ? "A few minutes" : "Under an hour";
    if (s.du === "hour") return "A few hours";
    const d = s.dmax;
    if (d <= 1) return "Same day";
    if (d <= 3) return "1–3 days";
    if (d <= 7) return "About a week";
    if (d <= 14) return "1–2 weeks";
    if (d <= 30) return "A few weeks";
    return "A month or more";
  }
  // critical-path duration (longest path by max days), not naive sum
  function rollup(nodes, edges) {
    let hidden = 0, fees = false;
    nodes.forEach((n) => { if (n.svc.hidden) hidden++; if (n.svc.cost !== "free") fees = true; });
    // longest path of dmax across the DAG
    const byId = {}; nodes.forEach((n) => (byId[n.id] = n));
    const memoLo = {}, memoHi = {};
    function dur(id, memo, key) {
      if (memo[id] !== undefined) return memo[id];
      const n = byId[id];
      const self = (n.svc[key] || 0) * (toDays[n.svc.du] || 0);
      const succ = n.succs.filter((s) => byId[s]);
      memo[id] = self + (succ.length ? Math.max(...succ.map((s) => dur(s, memo, key))) : 0);
      return memo[id];
    }
    const roots = nodes.filter((n) => n.preds.length === 0).map((n) => n.id);
    const lo = roots.length ? Math.max(...roots.map((r) => dur(r, memoLo, "dmin"))) : 0;
    const hi = roots.length ? Math.max(...roots.map((r) => dur(r, memoHi, "dmax"))) : 0;
    return { steps: nodes.length, hidden, lo: Math.round(lo), hi: Math.round(hi), fees };
  }

  function warnings(nodes, answers) {
    const p = buildProfile(answers);
    const out = [];
    nodes.forEach((n) => (n.svc.rules || []).forEach((r) => {
      if (test(r.when, p) && (r.sev === "high" || ["rejection", "illegal", "silent"].includes(r.mode))) {
        out.push({ sev: r.sev, msg: r.msg, tip: r.tip, step: n.svc.short || n.svc.name, stepId: n.id });
      }
    }));
    return out;
  }

  // overall "bring" list for a set of nodes
  function bringList(nodes) {
    const set = new Set();
    nodes.forEach((n) => n.svc.req.forEach((a) => { if (ARTIFACTS[a] && ARTIFACTS[a].bring) set.add(a); }));
    return [...set].map((a) => ARTIFACTS[a].name);
  }

  function matchGoal(text) {
    const t = (text || "").toLowerCase();
    if (!t) return null;
    for (const [id, j] of Object.entries(JOURNEYS)) {
      if (j.match.some((m) => t.includes(m))) return id;
    }
    return null;
  }

  window.ENGINE = {
    test, buildProfile, activeSteps, buildEdges, layout, status, missingFor,
    fmtDur, fmtDurFriendly, rollup, warnings, bringList, matchGoal, producerOf,
  };
})();
