/* ============================================================================
   M1 · Engine regression test
   Runs the ORIGINAL design engine (design-engine.js on design-dataset.js, via a
   `window` shim) and the TS PORT (engine.ts on the unified dataset.json) over all
   journeys × many profiles × layout options, and asserts identical output:
   active steps, node positions/order/depth, edges, width/height/dim, rollups,
   warnings, and progress status. Exits 1 on any mismatch.
   Run: node app/engine/regression.mjs
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createEngine } from "./engine.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "..", "data");

// ---- reference engine: load design data + engine into a window shim ----------
const win = {};
new Function("window", readFileSync(join(DATA_DIR, "_source/design-dataset.js"), "utf8"))(win);
new Function("window", readFileSync(join(DATA_DIR, "_source/design-engine.js"), "utf8"))(win);
const REF = win.ENGINE;

// ---- port engine: unified dataset.json --------------------------------------
const dataset = JSON.parse(readFileSync(join(DATA_DIR, "dataset.json"), "utf8"));
const MINE = createEngine(dataset);

const journeys = dataset.journeys.map((j) => j.id);
const OPTS = [{}, { hideHidden: true }, { variant: "compact" }, { variant: "transit" }, { density: "comfy" }, { density: "compact", variant: "transit" }];

// ---- profile matrix per journey ---------------------------------------------
function profilesFor(jid) {
  const qs = dataset.questions[jid] || [];
  const bools = qs.filter((q) => q.type === "bool");
  const choices = qs.filter((q) => q.type === "choice");
  const out = [{}];
  bools.forEach((q) => out.push({ [q.key]: true }));
  if (bools.length) out.push(Object.fromEntries(bools.map((q) => [q.key, true])));
  choices.forEach((q) => (q.opts || []).forEach((o) => out.push({ [q.key]: o.v })));
  return out;
}

// ---- comparison helpers ------------------------------------------------------
const diffs = [];
const near = (a, b) => Math.abs(a - b) < 1e-9;
function cmp(cond, label, ctx) { if (!cond) diffs.push(`${ctx} :: ${label}`); }

function nodeKey(n) {
  return { col: n.col, row: n.row, x: n.x, y: n.y, order: n.order, depth: n.depth,
    preds: [...n.preds].sort(), succs: [...n.succs].sort() };
}

let comparisons = 0;

for (const jid of journeys) {
  for (const answers of profilesFor(jid)) {
    // active steps
    const aRef = REF.activeSteps(jid, answers).map((s) => s.id);
    const aMine = MINE.activeSteps(jid, answers).map((s) => s.id);
    const pctx = `${jid} ${JSON.stringify(answers)}`;
    cmp(JSON.stringify(aRef) === JSON.stringify(aMine), `activeSteps [${aRef}] vs [${aMine}]`, pctx);

    for (const opts of OPTS) {
      const ctx = `${jid} ${JSON.stringify(answers)} ${JSON.stringify(opts)}`;
      const R = REF.layout(jid, answers, opts);
      const M = MINE.layout(jid, answers, opts);
      comparisons++;

      cmp(near(R.width, M.width), `width ${R.width} vs ${M.width}`, ctx);
      cmp(near(R.height, M.height), `height ${R.height} vs ${M.height}`, ctx);
      cmp(R.maxC === M.maxC, `maxC ${R.maxC} vs ${M.maxC}`, ctx);
      cmp(JSON.stringify(R.dim) === JSON.stringify(M.dim), `dim ${JSON.stringify(R.dim)} vs ${JSON.stringify(M.dim)}`, ctx);

      // nodes by id
      const rN = {}; R.nodes.forEach((n) => (rN[n.id] = nodeKey(n)));
      const mN = {}; M.nodes.forEach((n) => (mN[n.id] = nodeKey(n)));
      cmp(JSON.stringify(Object.keys(rN).sort()) === JSON.stringify(Object.keys(mN).sort()), `node id set`, ctx);
      Object.keys(rN).forEach((id) => {
        cmp(JSON.stringify(rN[id]) === JSON.stringify(mN[id]), `node ${id} ${JSON.stringify(rN[id])} vs ${JSON.stringify(mN[id])}`, ctx);
      });

      // edges
      const rE = R.edges.map((e) => `${e.from}->${e.to}|${e.path}`).sort();
      const mE = M.edges.map((e) => `${e.from}->${e.to}|${e.path}`).sort();
      cmp(JSON.stringify(rE) === JSON.stringify(mE), `edges (${rE.length} vs ${mE.length})`, ctx);

      // rollup
      const rR = REF.rollup(R.nodes, R.edges), mR = MINE.rollup(M.nodes, M.edges);
      cmp(JSON.stringify(rR) === JSON.stringify(mR), `rollup ${JSON.stringify(rR)} vs ${JSON.stringify(mR)}`, ctx);

      // warnings (compare by stepId+msg sorted)
      const rW = REF.warnings(R.nodes, answers).map((w) => `${w.stepId}|${w.msg}`).sort();
      const mW = MINE.warnings(M.nodes, answers).map((w) => `${w.stepId}|${w.msg}`).sort();
      cmp(JSON.stringify(rW) === JSON.stringify(mW), `warnings (${rW.length} vs ${mW.length})`, ctx);

      // status: mark the first root done, compare all node statuses
      const roots = M.nodes.filter((n) => n.preds.length === 0).map((n) => n.id);
      const doneSet = new Set(roots.slice(0, 1));
      const rS = R.nodes.map((n) => REF.status(n, doneSet)).join(",");
      const mS = M.nodes.map((n) => MINE.status(n, doneSet)).join(",");
      cmp(rS === mS, `status ${rS} vs ${mS}`, ctx);

      // friendly formatters on each node's service
      R.nodes.forEach((n, i) => {
        cmp(REF.fmtDur(n.svc) === MINE.fmtDur(M.nodes[i].svc), `fmtDur ${n.id}`, ctx);
        cmp(REF.fmtDurFriendly(n.svc) === MINE.fmtDurFriendly(M.nodes[i].svc), `fmtDurFriendly ${n.id} (${REF.fmtDurFriendly(n.svc)} vs ${MINE.fmtDurFriendly(M.nodes[i].svc)})`, ctx);
      });

      // bring list
      const rB = REF.bringList(R.nodes).slice().sort();
      const mB = MINE.bringList(M.nodes).slice().sort();
      cmp(JSON.stringify(rB) === JSON.stringify(mB), `bringList`, ctx);
    }
  }
}

// matchGoal parity
["open a restaurant", "transfer my land", "passport please", "get married", "nothing"].forEach((t) => {
  cmp(REF.matchGoal(t) === MINE.matchGoal(t), `matchGoal("${t}") ${REF.matchGoal(t)} vs ${MINE.matchGoal(t)}`, "matchGoal");
});

console.log(`Compared ${comparisons} layouts across ${journeys.length} journeys.`);
if (diffs.length) {
  console.log(`\nMISMATCHES (${diffs.length}, showing first 25):`);
  diffs.slice(0, 25).forEach((d) => console.log("  ✗ " + d));
  process.exit(1);
}
console.log("ENGINE PARITY ✓ — TS port matches the design engine exactly.");
