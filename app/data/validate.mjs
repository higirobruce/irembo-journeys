/* ============================================================================
   M0 · Dataset validator (dependency-free)
   Checks schema constraints (ids, enums, required fields), referential
   integrity (agency/artifact/service refs), graph completeness, per-journey
   goal reachability (mirrors the engine), and i18n catalog parity.
   Run: node app/data/validate.mjs   (exit 1 on any error)
   ============================================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(HERE, "dataset.json"), "utf8"));
const en = JSON.parse(readFileSync(join(HERE, "locales/en.json"), "utf8"));
const rw = JSON.parse(readFileSync(join(HERE, "locales/rw.json"), "utf8"));

const errs = [], warns = [];
const E = (m) => errs.push(m), W = (m) => warns.push(m);

const agencyIds = new Set(d.agencies.map((a) => a.id));
const artifactIds = new Set(d.artifacts.map((a) => a.id));
const serviceById = Object.fromEntries(d.services.map((s) => [s.id, s]));
const serviceIds = new Set(Object.keys(serviceById));

// ---- enums ---------------------------------------------------------------
const ENUM = {
  agencyType: ["national", "local-government", "sector-regulator", "financial", "external", "judicial", "self"],
  costModel: ["free", "fee", "fixed", "variable", "unknown"],
  durUnit: ["instant", "min", "hour", "day", "week"],
  severity: ["high", "medium", "low"],
  failureMode: ["rejection", "silent-liability", "illegal-operation", "rework"],
  metaStatus: ["draft", "review", "published"],
  metaSource: ["irembo", "manual"],
  qType: ["choice", "bool"],
};

// ---- agencies ------------------------------------------------------------
const seenA = new Set();
for (const a of d.agencies) {
  if (seenA.has(a.id)) E(`duplicate agency id ${a.id}`); seenA.add(a.id);
  if (!ENUM.agencyType.includes(a.type)) E(`agency ${a.id}: bad type ${a.type}`);
  if (a.color && !/^#[0-9A-Fa-f]{6}$/.test(a.color)) E(`agency ${a.id}: bad color ${a.color}`);
}

// ---- artifacts -----------------------------------------------------------
const seenArt = new Set();
for (const a of d.artifacts) {
  if (seenArt.has(a.id)) E(`duplicate artifact id ${a.id}`); seenArt.add(a.id);
  if (a.issuedBy && !agencyIds.has(a.issuedBy)) E(`artifact ${a.id}: issuedBy unknown ${a.issuedBy}`);
}

// ---- services + graph completeness --------------------------------------
const producedBy = {};
d.services.forEach((s) => (s.produces || []).forEach((p) => { (producedBy[p] = producedBy[p] || []).push(s.id); }));

for (const s of d.services) {
  if (!/^[a-z0-9-]+$/.test(s.id)) E(`bad service id ${s.id}`);
  if (!agencyIds.has(s.agency)) E(`service ${s.id}: unknown agency ${s.agency}`);
  if (!ENUM.costModel.includes(s.cost?.model)) E(`service ${s.id}: bad cost.model ${s.cost?.model}`);
  if (!ENUM.durUnit.includes(s.duration?.unit)) E(`service ${s.id}: bad duration.unit ${s.duration?.unit}`);
  (s.requires || []).forEach((r) => { if (!artifactIds.has(r)) E(`service ${s.id}: requires unknown artifact ${r}`); });
  (s.produces || []).forEach((p) => { if (!artifactIds.has(p)) E(`service ${s.id}: produces unknown artifact ${p}`); });
  (s.rules || []).forEach((r, i) => {
    if (!ENUM.severity.includes(r.severity)) E(`service ${s.id} rule ${i}: bad severity ${r.severity}`);
    if (!ENUM.failureMode.includes(r.failureMode)) E(`service ${s.id} rule ${i}: bad failureMode ${r.failureMode}`);
  });
  if (s._meta) {
    if (!ENUM.metaStatus.includes(s._meta.status)) E(`service ${s.id}: bad _meta.status ${s._meta.status}`);
    if (!ENUM.metaSource.includes(s._meta.source)) E(`service ${s.id}: bad _meta.source ${s._meta.source}`);
  }
}

// every required artifact must be produced by SOME service, unless citizen-brought
const bring = new Set(d.artifacts.filter((a) => a.bring).map((a) => a.id));
d.services.forEach((s) => (s.requires || []).forEach((r) => {
  if (!producedBy[r] && !bring.has(r)) E(`artifact '${r}' required by ${s.id} is never produced and not a 'bring' artifact`);
}));

// ---- engine mirror: condition test + activeSteps -------------------------
function test(c, p) {
  if (!c) return true;
  if (c.allOf) return c.allOf.every((x) => test(x, p));
  if (c.anyOf) return c.anyOf.some((x) => test(x, p));
  const v = p[c.v];
  switch (c.op) {
    case "eq": return v === c.val;
    case "neq": return v !== c.val;
    case "gte": return v >= c.val;
    case "gt": return v > c.val;
    case "lte": return v <= c.val;
    case "lt": return v < c.val;
    case "in": return (c.val || []).includes(v);
    case "exists": return v !== undefined;
    default: return true;
  }
}
function buildProfile(journeyId, answers) {
  const seeded = {};
  (d.questions[journeyId] || []).forEach((q) => { seeded[q.key] = q.def; });
  Object.assign(seeded, answers || {});
  const p = { applicantAge: 30, ...seeded };
  p.legalStructure = seeded.legalStructure || "enterprise";
  p.annualTurnoverRWF = seeded.turnoverHigh ? 25000000 : 8000000;
  return p;
}
function activeSteps(journeyId, answers) {
  const p = buildProfile(journeyId, answers);
  return d.journeys.find((j) => j.id === journeyId).steps
    .map((st) => serviceById[st.service])
    .filter((svc) => svc && test(svc.appliesWhen, p));
}

// ---- journeys + reachability --------------------------------------------
const seenJ = new Set();
for (const j of d.journeys) {
  if (seenJ.has(j.id)) E(`duplicate journey id ${j.id}`); seenJ.add(j.id);
  j.steps.forEach((st) => { if (!serviceIds.has(st.service)) E(`journey ${j.id}: step references unknown service ${st.service}`); });
  (j.outcomeArtifacts || []).forEach((o) => { if (!artifactIds.has(o)) E(`journey ${j.id}: outcome unknown artifact ${o}`); });

  // with DEFAULT answers, the goal artifact must be produced by an active step
  const active = activeSteps(j.id, {});
  const producedActive = new Set();
  active.forEach((s) => (s.produces || []).forEach((p) => producedActive.add(p)));
  (j.outcomeArtifacts || []).forEach((goal) => {
    if (!producedActive.has(goal)) E(`journey ${j.id}: goal artifact '${goal}' not produced by any active step (default answers)`);
  });
  // every active step's requires must be satisfiable within the active set or brought
  active.forEach((s) => (s.requires || []).forEach((r) => {
    const prodActive = active.some((x) => (x.produces || []).includes(r));
    if (!prodActive && !bring.has(r)) W(`journey ${j.id}: ${s.id} needs '${r}' but no active step produces it (default answers)`);
  }));
}

// ---- questions reference real journeys -----------------------------------
Object.keys(d.questions || {}).forEach((jid) => {
  if (!seenJ.has(jid)) E(`questions for unknown journey ${jid}`);
  d.questions[jid].forEach((q) => { if (!ENUM.qType.includes(q.type)) E(`question ${jid}.${q.key}: bad type ${q.type}`); });
});

// ---- i18n parity ---------------------------------------------------------
const enKeys = Object.keys(en).sort(), rwKeys = Object.keys(rw).sort();
if (enKeys.length !== rwKeys.length || enKeys.some((k, i) => k !== rwKeys[i])) E("locale key sets differ between en.json and rw.json");
const rwFilled = Object.values(rw).filter((v) => v).length;

// ---- report --------------------------------------------------------------
console.log(`Totals: ${d.agencies.length} agencies · ${d.artifacts.length} artifacts · ${d.services.length} services · ${d.journeys.length} journeys · ${Object.keys(d.questions).length} question sets`);
console.log(`Reachability: all ${d.journeys.length} journeys checked against default answers`);
console.log(`i18n: ${enKeys.length} keys · rw translated ${rwFilled}/${enKeys.length}`);
if (warns.length) console.log("\nWARNINGS:\n  " + warns.join("\n  "));
if (errs.length) { console.log("\nERRORS:\n  " + errs.join("\n  ")); console.log(`\nVALIDATION FAILED (${errs.length})`); process.exit(1); }
console.log("\nVALIDATION PASS ✓");
