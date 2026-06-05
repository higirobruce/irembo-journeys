# Irembo Companion — Agent Side-Panel — Technical Spec

**Status:** v0.1 draft · companion to `brainstorm.html` (v0.6) and `data/dataset.json`
**Audience:** the engineer who builds the Phase-1 prototype.

---

## 1. Goal & non-goals

**Goal.** A browser side-panel an Irembo *agent* opens next to `irembo.gov.rw` (and the RDB / RLMUA portals). It reads the page the agent is already on, figures out which step of which journey they're in, and overlays: the full journey map, what's still owed (the hidden tail), pre-flight warnings for the rules in `dataset.json`, and one-click prefill of repeated fields. The agent reviews and submits.

**Non-goals (v1).**
- No autonomous submission. The agent always clicks the real submit button. (Human-in-the-loop — locked decision Q3.)
- No RISA API / integration. We read the DOM the agent is on; we never call a private backend. ("Beside", not "with" — Q1.)
- No server-side store of citizen PII (see §10).
- No citizen-facing channel yet (that's Phase 3 — voice/USSD).

---

## 2. Principles

| Principle | Consequence in the build |
|---|---|
| **Beside, not integrated** | Everything is derived from the rendered page + bundled data. No credentials, no private endpoints. |
| **Human-in-the-loop** | The extension can *fill* fields but never *submits*. Pre-flight checks fire *before* the agent's click, as a warning, not a block. |
| **Local-first** | Citizen profile + documents live in the browser (IndexedDB), encrypted, scoped to the agent's device. |
| **Data-driven** | Journey logic = `dataset.json`; page coupling = `adapters.json`. Code is a thin renderer + engine. Updating rules/selectors ships as data, not a new build. |
| **Degrade gracefully** | If a page isn't recognised, the panel still shows the read-only journey map (Phase-0 value) and never breaks the agent's real workflow. |

---

## 3. Architecture

```
┌──────────────────────────── Browser ────────────────────────────┐
│                                                                  │
│   irembo.gov.rw / org.rdb.rw / RLMUA           Side Panel        │
│   ┌───────────────────────────┐         ┌─────────────────────┐ │
│   │  Government page (DOM)     │         │  Companion UI (React)│ │
│   └─────────────▲─────────────┘         └──────────▲──────────┘ │
│                 │ observe (read-only)               │ render     │
│   ┌─────────────┴─────────────┐         ┌──────────┴──────────┐ │
│   │  Content script            │ events  │  Engine             │ │
│   │  · page recognizer         ├────────►│  · path-finder      │ │
│   │  · field reader (adapters) │         │  · rule evaluator   │ │
│   │  · prefill writer (on cmd) │◄────────┤  · cost/time rollup │ │
│   └────────────────────────────┘ fill    └──────────▲──────────┘ │
│                                                      │            │
│                    ┌─────────────────┐    ┌──────────┴────────┐  │
│                    │ dataset.json     │    │ Local profile     │  │
│                    │ adapters.json    │    │ store (IndexedDB, │  │
│                    │ (bundled data)   │    │ encrypted)        │  │
│                    └─────────────────┘    └───────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Five components:

1. **Content script** — injected into the gov pages. Observes the DOM (MutationObserver), recognises the current page via `adapters.json`, reads field values, and — only on an explicit panel command — writes suggested values into inputs. Never clicks submit.
2. **Engine** — pure functions over `dataset.json` + the current profile. Produces the derived views (§5). Identical logic to the validator we already run in Node.
3. **Side-panel UI** — the agent-facing surface (browser side-panel / `sidePanel` API).
4. **Bundled data** — `dataset.json` (journeys/rules) and `adapters.json` (page→service map). Hot-updatable.
5. **Local profile store** — the citizen-in-front-of-the-agent: collected field values + captured documents, encrypted in IndexedDB, one record per client, purgeable.

---

## 4. How it tracks the agent (page recognition)

The content script matches the active page against `adapters.json#pages[]`:

1. **URL match** — `match.urlIncludes` (cheap first pass).
2. **DOM signature** — `match.domSignature` CSS selector must exist (disambiguates SPA routes that share a URL).
3. On match → emit `PageEntered { pageId, serviceId }` to the engine.

The engine maps `serviceId → step` in the active journey and advances the journey state. If a produced artifact's "success" signature appears (e.g. a certificate number renders), it emits `ArtifactObtained { artifactId }` and marks the step done.

**Journey selection.** The agent picks the goal once (a dropdown of `journey.goalPhrases`), or the panel infers it from the first recognised page. Stored on the client record.

---

## 5. The engine — derived views (reused from the validator)

Given `(journey, profile)`, the engine computes — exactly as the Node validator already does:

- **Active path** — `steps` filtered by each service's `appliesWhen` against the profile (conditional pruning).
- **Status per step** — `done` (artifact obtained) / `ready` (all `requires` satisfied) / `blocked` (missing a required artifact) / `not-applicable` (pruned).
- **Blockers** — for a `blocked` step, the specific missing artifact(s) and which earlier step produces them.
- **Roll-up** — step count, hidden-tail count, cost band, min–max duration.
- **Active rules** — every rule whose `when` holds for this profile, grouped by `failureMode`.

This is the same code path proven against both journeys; the extension just renders its output.

---

## 6. Rule-firing model

Rules fire at three moments, chosen by `failureMode`:

| Trigger | When | Which rules | UI |
|---|---|---|---|
| **On-intake** | journey chosen / profile edited | `eligibility` (e.g. `rule.id-expired`, `rule.minor`, `rule.missing-spousal-consent`) | red banner at top of panel, persists until resolved |
| **On-field** | content script reads a field value | `completeness`, `quality` (e.g. `rule.name-taken`, `rule.wrong-isic`) | inline chip next to the step + suggestion |
| **Pre-submit** | agent focuses/clicks the page's submit button | all `rejection`-mode rules for the current service | a non-blocking confirm overlay: *"2 likely-rejection issues — review before submitting"* |

`silent-liability` and `illegal-operation` rules never block; they raise a persistent reminder card (e.g. *"You still need a sector permit before operating"*) tied to the journey, surviving across sessions for that client.

**Pre-submit is the highest-value, trickiest hook.** It attaches a capture-phase listener on the submit control to render a warning *before* the form posts — but it must never call `preventDefault()` indefinitely. The agent can dismiss and submit anyway (human-in-the-loop, and our rules are advisory + possibly stale).

---

## 7. UI spec

Single side-panel, four stacked regions:

1. **Client + goal header** — client name, chosen journey, overall progress (e.g. "4 / 9 steps, ~10–75 days remaining").
2. **Alert stack** — active high-severity rules (on-intake + persistent reminders), most severe first.
3. **Journey checklist** — the ordered active path. Each row: status dot (done/ready/blocked/n-a), step name, agency chip, cost/time, and a `HIDDEN` tag for tail steps. Blocked rows show "needs: X (from step N)". Tapping a row expands its rules + mitigations.
4. **Step actions** — for the current step: the field-level warnings, "Fill from profile" button (prefill), and document capture.

States: `no-page-match` (read-only map only), `recognised` (full), `submitting` (pre-submit overlay), `offline` (data is bundled, so still works).

---

## 8. Cross-step prefill & document reuse (human-in-the-loop)

- Fields read at step N (name, NID, address) populate the **profile**; at step M the content script offers to **write** them via `adapters.json#pages[].writes`.
- Writing dispatches real `input`/`change` events so the page's framework registers the value; then **stops**. The agent verifies and submits.
- Documents captured once (ID, lease/title) are stored locally and re-offered for upload on later steps — the seed of the `reusable: true` artifacts in `dataset.json` (national-id, premises-proof, certificate, land-title).

---

## 9. Page-adapter layer — `adapters.json`

The only part coupled to government HTML, isolated as **data** so breakage is a config edit, not a release. Shape:

```jsonc
{
  "pages": [{
    "id": "page.rdb.name-search",
    "portal": "rdb",
    "matchesService": "svc.name-reservation",   // ties to dataset.json
    "match": { "urlIncludes": ["/name"], "domSignature": "#nameForm" },
    "reads":  [{ "selector": "#name", "writeTo": "profile.businessName" }],
    "writes": [{ "selector": "#applicantId", "readFrom": "profile.nationalId" }],
    "submit": { "selector": "button[type=submit]", "preflightRules": ["rule.name-taken"] },
    "successSignature": ".reservation-code"      // => ArtifactObtained
  }]
}
```

**Anti-fragility:**
- Selectors are versioned data; a broken selector disables *that page's* enhancements only, never the panel.
- A self-test runs each adapter's `match` + `reads` on load and reports dead selectors to telemetry (§11), so we learn the portal changed before agents complain.
- Prefer stable hooks (label text, `name=`, ARIA) over brittle nth-child chains.

> All selectors in the shipped `adapters.json` are **PLACEHOLDERS** — they must be captured against the live portals (a 1-day DOM-inventory task). Marked `CONFIRM`.

---

## 10. Privacy & security

- Citizen PII (profile + documents) is **client-local**, encrypted at rest (WebCrypto key in the extension's storage), never sent to a server in v1.
- The agent sees only their own clients. A client record is purgeable; auto-expire after N days.
- The extension requests the **minimum host permissions** (the three portal origins) and `sidePanel`, `storage`, `scripting`. No `tabs`-wide or `<all_urls>` access.
- We log *events and rule outcomes*, not field values, to telemetry. Document images never leave the device.
- Be explicit with agents: the tool reads what's on screen to help; it does not transmit their clients' documents.

---

## 11. The rejection-capture loop (feeds Q4)

When the agent dismisses a pre-submit warning and submits, and later a step is rejected, the panel asks the agent to tag the **reason** (from the rule list, or free text). That stream:

- Validates / corrects the `dataset.json` rules and the `CONFIRM` fees in the field.
- Promotes `sourceConfidence: needs-verification → verified` with real frequencies.
- Is the cheapest way to keep the rule base honest — the agents are the sensor network.

---

## 12. Tech stack & manifest

- **Manifest V3** Chrome/Edge extension (Edge matters — common in gov offices).
- React + TypeScript side-panel; vanilla content script (small, resilient).
- Engine in TS, shared with the Node validator (one source of truth).
- Bundled `dataset.json` + `adapters.json`; remote config refresh later.

```jsonc
// manifest.json (sketch)
{
  "manifest_version": 3,
  "name": "Irembo Companion (Agent)",
  "permissions": ["sidePanel", "storage", "scripting"],
  "host_permissions": [
    "*://*.irembo.gov.rw/*", "*://*.rdb.rw/*", "*://*.rlmua.gov.rw/*"  // CONFIRM hosts
  ],
  "side_panel": { "default_path": "panel.html" },
  "content_scripts": [{
    "matches": ["*://*.irembo.gov.rw/*", "*://*.rdb.rw/*", "*://*.rlmua.gov.rw/*"],
    "js": ["content.js"], "run_at": "document_idle"
  }]
}
```

---

## 13. MVP cut & milestones

- **M0 — Read-only map (1 wk).** Side-panel renders the active journey from `dataset.json` for a manually chosen goal. No DOM coupling. = Phase-0 Atlas, shippable alone.
- **M1 — Recognition + alerts (1–2 wk).** `adapters.json` for ~4 key pages (NID verify, RDB name, RDB registration, RLMUA transfer). On-intake + persistent reminders. Self-test for dead selectors.
- **M2 — Prefill + capture (1–2 wk).** Cross-step field prefill + local document store for the `reusable` artifacts.
- **M3 — Pre-submit + capture loop (1–2 wk).** Pre-submit overlay and the rejection-tagging stream (§11).

Each milestone is independently demoable to an agent.

---

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gov portals are SPAs / change DOM | adapters-as-data + self-test + graceful degrade to read-only map |
| Selectors unknown today | 1-day DOM inventory against live portals; everything marked `CONFIRM` until then |
| Pre-submit hook fights the page's own JS | capture-phase listener, advisory only, never permanently block |
| Agents distrust / ignore it | start with pure time-savers (prefill, "what's left"); earn the warnings |
| PII handling | local-only, encrypted, minimal permissions, no document exfiltration |
| Stale rules cause false warnings | advisory framing + capture loop continuously corrects them |
