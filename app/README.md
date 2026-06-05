# Irembo Journey Companion — production build

Implements the Claude Design handoff (`gov-services-journies`) per `../plan.html`.
**Stack (locked):** Next.js + TypeScript · engine + data as framework-agnostic packages.
**First ship (locked):** citizen app only (M0–M2), static-hostable, no backend.

## Status
- ✅ **M0 — Data unification** (`data/`)
- ✅ **M1 — Engine port** to TypeScript (`engine/`) — verified identical to the design engine (222 layout comparisons)
- ⏳ **M2 — Citizen app** (Next.js) — pixel-match the design
- later: M3 admin · M4 backend + real scraper · M5 journey-assembly + Kinyarwanda content

## Layout
```
app/
  package.json               type:module + scripts (data:migrate/validate, engine:test)
  data/
    schema.json              canonical JSON Schema (v1, unified)
    dataset.json             single source of truth — 6 journeys (GENERATED)
    locales/en.json          English catalog, derived (GENERATED)
    locales/rw.json          Kinyarwanda catalog — empty scaffold (D7) (GENERATED)
    migrate.mjs              _source design data -> dataset.json + locales
    validate.mjs             schema + referential + reachability + i18n checks
    _source/                 design prototype data (provenance; do not edit)
  engine/
    types.ts                 canonical dataset + layout types (erasable)
    engine.ts                createEngine(dataset) — Sugiyama LR layout, rollups, warnings
    regression.mjs           parity test vs design engine (222 layouts, must match)
```

> Engine runs under Node 24's native TypeScript type-stripping (no build step for tests).
> Add `tsc --noEmit` to CI once dev deps are installed for full type-checking.

## Commands
```
node app/data/migrate.mjs    # regenerate dataset.json + locales from _source
node app/data/validate.mjs   # CI gate: exits non-zero on any error
```

## Data model (M0 outcome)
Artifact-based dependency graph: services **require** and **produce** artifacts; the
graph/layout/rollups all derive from matching `requires`↔`produces`. Unified from the
design prototype into our schema — field renames applied (`ag→agency`,
`du/dmin/dmax→duration`, `when→appliesWhen`, rule `sev/mode/msg/tip →
severity/failureMode/message/mitigation`), plus added `short`, `desc`, `hidden`,
agency `color`/`where`, per-service `_meta` (admin lifecycle), and `questions`.

- **6 journeys:** open-restaurant, transfer-land, birth-certificate, passport, driving-license, marriage
- **i18n-ready (D7):** English is inline in `dataset.json`; Kinyarwanda is an overlay in
  `locales/rw.json` (347 keys, empty). UI resolves `rw[key] || englishSource`.
- **Accuracy (D6):** `sourceConfidence: needs-verification`. Fees/timelines/rules are
  modeled, not policy-checked — domain reviewers verify via the admin review queue.

> `data/dataset.json` here supersedes the prototype's root `../data/dataset.json` (2 journeys).
