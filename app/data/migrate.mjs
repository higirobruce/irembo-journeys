/* ============================================================================
   M0 · Data unification
   Transforms the Claude Design prototype data (_source/design-dataset.js,
   keyed-object shape with short field names) into our canonical schema shape
   (arrays, full field names) and emits:
     - dataset.json        the single source of truth (6 journeys), English inline
     - locales/en.json     derived English catalog (reference for translators)
     - locales/rw.json     empty Kinyarwanda catalog scaffold (D7: i18n-ready)
   Run: node app/data/migrate.mjs
   ============================================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---- load the design data by shimming `window` --------------------------------
const code = readFileSync(join(HERE, "_source/design-dataset.js"), "utf8");
const win = {};
new Function("window", code)(win);
const { AGENCIES, ARTIFACTS, SERVICES, JOURNEYS, QUESTIONS } = win.DATA;

// ---- admin _meta seed (mirrors design-admin-store.js SEED) --------------------
const SEED = {
  "sector":   { status: "review", source: "irembo", updated: "2026-06-02", note: "Re-scraped — hygiene fee schedule changed" },
  "ebm":      { status: "review", source: "irembo", updated: "2026-06-01", note: "New EBM 2.1 device requirement detected" },
  "coowner":  { status: "draft",  source: "manual", updated: "2026-05-28", note: "Consent rules need legal review" },
  "foreigner-impediment": { status: "review", source: "manual", updated: "2026-05-30", note: "Embassy list incomplete" },
  "matrimonial-regime":   { status: "draft", source: "manual", updated: "2026-05-21", note: "Awaiting notary fee confirmation" },
};
const metaFor = (id, svc) =>
  SEED[id] ? { ...SEED[id] } : {
    status: "published",
    source: svc.ag === "self" ? "manual" : "irembo",
    updated: "2026-05-12",
    note: "",
  };

// ---- agency type inference (design data had no `type`) ------------------------
const AGENCY_TYPE = {
  self: "self", nida: "national", rdb: "national", rra: "national",
  district: "local-government", health: "sector-regulator", rssb: "national",
  bank: "financial", rlmua: "national", notary: "external", civil: "local-government",
  police: "national", immigration: "national", court: "judicial",
};

// ---- field-value maps ---------------------------------------------------------
const SEV   = { high: "high", med: "medium", low: "low" };
const MODE  = { rejection: "rejection", silent: "silent-liability", illegal: "illegal-operation", rework: "rework" };

// ---- producer index (to derive artifact issuedBy) ----------------------------
const producerAgency = {};
Object.entries(SERVICES).forEach(([sid, s]) =>
  (s.pro || []).forEach((art) => { if (!(art in producerAgency)) producerAgency[art] = s.ag; })
);

// ---- transform: agencies ------------------------------------------------------
const agencies = Object.entries(AGENCIES).map(([id, a]) => ({
  id, name: a.name, short: a.short, color: a.color, where: a.where,
  type: AGENCY_TYPE[id] || "national",
}));

// ---- transform: artifacts -----------------------------------------------------
const artifacts = Object.entries(ARTIFACTS).map(([id, a]) => ({
  id, name: a.name,
  bring: !!a.bring,
  issuedBy: producerAgency[id] || (a.bring ? "self" : "self"),
}));

// ---- transform: services ------------------------------------------------------
const services = Object.entries(SERVICES).map(([id, s]) => ({
  id,
  name: s.name,
  short: s.short || s.name,
  agency: s.ag,
  desc: s.desc || "",
  requires: s.req || [],
  produces: s.pro || [],
  cost: { model: s.cost === "fee" ? "fee" : "free" },
  duration: { min: s.dmin ?? 0, max: s.dmax ?? 0, unit: s.du || "day" },
  hidden: !!s.hidden,
  appliesWhen: s.when || null,
  rules: (s.rules || []).map((r) => ({
    severity: SEV[r.sev] || "medium",
    failureMode: MODE[r.mode] || "rejection",
    when: r.when || null,
    message: r.msg || "",
    mitigation: r.tip || "",
  })),
  _meta: metaFor(id, s),
}));

// ---- transform: journeys ------------------------------------------------------
const journeys = Object.entries(JOURNEYS).map(([id, j]) => ({
  id,
  name: j.title,
  blurb: j.blurb || "",
  icon: j.icon,
  goalPhrases: j.match || [],
  outcomeArtifacts: j.goal ? [j.goal] : [],
  steps: j.steps.map((service, i) => ({ order: i, service })),
}));

// ---- transform: questions (keep keyed by journey) -----------------------------
const questions = {};
Object.entries(QUESTIONS).forEach(([jid, qs]) => {
  questions[jid] = qs.map((q) => ({
    key: q.key, label: q.label, type: q.type, def: q.def,
    opts: (q.opts || []).map((o) => ({ v: o.v, l: o.l })),
  }));
});

// ---- assemble dataset.json ----------------------------------------------------
const dataset = {
  version: "1.0.0",
  updatedAt: new Date().toISOString().slice(0, 10),
  sourceConfidence: "needs-verification",
  defaultLocale: "en",
  locales: ["en", "rw"],
  notes:
    "Unified from the Claude Design prototype (_source/design-dataset.js) into the canonical schema. " +
    "6 journeys. Fees/timelines/rules are MODELED, not verified (D6: domain reviewers). " +
    "English strings are inline here (source); Kinyarwanda lives in locales/rw.json (D7).",
  agencies, artifacts, services, journeys, questions,
};

writeFileSync(join(HERE, "dataset.json"), JSON.stringify(dataset, null, 2) + "\n");

// ---- i18n catalogs (D7) -------------------------------------------------------
// Flat key -> string. en derived from source; rw empty for translators to fill.
const en = {};
const add = (k, v) => { if (v != null && v !== "") en[k] = v; };
agencies.forEach((a) => { add(`agency.${a.id}.name`, a.name); add(`agency.${a.id}.where`, a.where); });
artifacts.forEach((a) => add(`artifact.${a.id}.name`, a.name));
services.forEach((s) => {
  add(`service.${s.id}.name`, s.name);
  add(`service.${s.id}.short`, s.short);
  add(`service.${s.id}.desc`, s.desc);
  s.rules.forEach((r, i) => { add(`service.${s.id}.rule.${i}.message`, r.message); add(`service.${s.id}.rule.${i}.mitigation`, r.mitigation); });
});
journeys.forEach((j) => { add(`journey.${j.id}.name`, j.name); add(`journey.${j.id}.blurb`, j.blurb); });
Object.entries(questions).forEach(([jid, qs]) => qs.forEach((q) => {
  add(`question.${jid}.${q.key}.label`, q.label);
  q.opts.forEach((o) => add(`question.${jid}.${q.key}.opt.${o.v}`, o.l));
}));

// preserve any existing Kinyarwanda translations across regenerations
let existingRw = {};
try { existingRw = JSON.parse(readFileSync(join(HERE, "locales/rw.json"), "utf8")); } catch { /* first run */ }
const rw = {};
Object.keys(en).forEach((k) => { rw[k] = existingRw[k] || ""; });

writeFileSync(join(HERE, "locales/en.json"), JSON.stringify(en, null, 2) + "\n");
writeFileSync(join(HERE, "locales/rw.json"), JSON.stringify(rw, null, 2) + "\n");

// ---- report -------------------------------------------------------------------
console.log("M0 migration complete:");
console.log(`  agencies   ${agencies.length}`);
console.log(`  artifacts  ${artifacts.length}`);
console.log(`  services   ${services.length}`);
console.log(`  journeys   ${journeys.length}  (${journeys.map((j) => j.id).join(", ")})`);
console.log(`  questions  ${Object.keys(questions).length} sets`);
console.log(`  i18n keys  ${Object.keys(en).length}  (en filled; rw preserved across regen)`);
