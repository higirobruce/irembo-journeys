# Irembo Journey Companion — production build

Implements the Claude Design handoff (`gov-services-journies`) per `../plan.html`.
**Stack (locked):** Next.js + TypeScript · engine + data as framework-agnostic packages.
**First ship (locked):** citizen app only (M0–M2), static-hostable, no backend.

## Status
- ✅ **M0 — Data unification** (`data/`)
- ✅ **M1 — Engine port** to TypeScript (`engine/`) — verified identical to the design engine (222 layout comparisons)
- ✅ **M2 — Citizen app** (Next.js) — `src/app` + `src/components`
- ✅ **M3 — Admin console** (`/admin`) — catalog, review queue, editor, Import-from-Irembo wizard
- 🟡 **M4 — Backend (scaffold)** — API routes + repo abstraction + auth roles + Prisma schema + server scraper seam (below)
- later: M4 proper (provision Postgres, wire PrismaRepo, real fetch) · M5 journey-assembly + Kinyarwanda content

## M4 backend (scaffold)
A repository seam lets the API run **now** (in-memory `JsonRepo` over `dataset.json`) and swap to Postgres later (`PrismaRepo`) with no API changes.

```
src/lib/server/
  auth.ts        roles (editor/reviewer/publisher) + requirePermission guard
  repo.ts        DataRepo interface + JsonRepo (works today) + getRepo() factory
  prismaRepo.ts  Postgres impl — skeleton (no @prisma/client import yet)
  scraper.ts     server-side Irembo scrape; fetchPage() is the real-fetch seam
src/app/api/
  services/                 GET list · POST create (edit)
  services/[id]/            GET one · PATCH (edit)
  services/[id]/status/     POST promote (approve/publish — role-gated)
  import/scrape/            POST {url} -> scraped draft + auto-linked deps (edit)
  import/                   POST {svc,newArtifacts} -> review queue (edit)
prisma/schema.prisma   Postgres models (Service/Artifact/Journey/User/AuditLog)
prisma/seed.ts         loads dataset.json into the DB (scaffold)
.env.example           DATABASE_URL · DATA_BACKEND · auth
```
Auth is a **dev stub**: role comes from the `x-user-role` header (default `publisher`); real session auth replaces `roleFromRequest()`. Verified: `/api/import/scrape` auto-links 3 + flags 2 new on the Construction Permit; publish is 403 for `editor`, 200 for `publisher`.

**To make M4 real:** `npm i -D prisma tsx && npm i @prisma/client` → set `DATABASE_URL` → `npm run db:migrate` → `npm run db:seed` → implement `PrismaRepo` → set `DATA_BACKEND=prisma`.

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
