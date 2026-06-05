/* Admin store — wraps the canonical dataset with editable per-service metadata
   and localStorage persistence. Client-only (guards localStorage).
   Ported from the design admin-store.js onto the canonical shape. */
import { dataset } from "@/lib/data";
import type { Service, Artifact } from "@engine/types";

export interface AdminService extends Service {
  _meta: { status: "draft" | "review" | "published"; source: "irembo" | "manual"; updated?: string; note?: string };
}
export interface AdminJourney { id: string; name: string; icon?: string; steps: string[] }
export interface AdminState {
  services: Record<string, AdminService>;
  artifacts: Record<string, Artifact>;
  journeys: Record<string, AdminJourney>;
  v: number;
}

const LS_KEY = "irembo.admin.v1";
const isBrowser = typeof window !== "undefined";
export function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }
export function today(): string { return new Date().toISOString().slice(0, 10); }

function load(): AdminState | null {
  if (!isBrowser) return null;
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
}
export function save(state: AdminState): void {
  if (!isBrowser) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore quota */ }
}
export function clear(): void { if (isBrowser) try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } }

function freshMeta(s: Service): AdminService["_meta"] {
  const m = (s as AdminService)._meta;
  if (m) return { ...m };
  return { status: "published", source: s.agency === "self" ? "manual" : "irembo", updated: "2026-05-12", note: "" };
}

export function initialState(): AdminState {
  const saved = load();
  if (saved && saved.services) return saved;
  const services: Record<string, AdminService> = {};
  dataset.services.forEach((s) => { services[s.id] = { ...deepClone(s), _meta: freshMeta(s) }; });
  const artifacts: Record<string, Artifact> = {};
  dataset.artifacts.forEach((a) => { artifacts[a.id] = deepClone(a); });
  const journeys: Record<string, AdminJourney> = {};
  dataset.journeys.forEach((j) => { journeys[j.id] = { id: j.id, name: j.name, icon: j.icon, steps: j.steps.map((st) => st.service) }; });
  return { services, artifacts, journeys, v: 1 };
}

export function journeysUsing(state: AdminState, id: string): { id: string; title: string }[] {
  return Object.values(state.journeys).filter((j) => j.steps.includes(id)).map((j) => ({ id: j.id, title: j.name }));
}
export function producerOf(state: AdminState, artId: string): string | null {
  const hit = Object.values(state.services).find((s) => (s.produces || []).includes(artId));
  return hit ? hit.id : null;
}
export function statusCounts(state: AdminState): Record<string, number> {
  const c: Record<string, number> = { published: 0, review: 0, draft: 0 };
  Object.values(state.services).forEach((s) => { c[s._meta.status] = (c[s._meta.status] || 0) + 1; });
  return c;
}
export function slugify(s: string): string {
  return (s || "service").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "service-" + Date.now();
}

/* ============================================================================
   SIMULATED IREMBO SCRAPE (D3: pure HTML scraping is a server job in production;
   browsers can't cross-origin fetch Irembo, so this returns realistic raw
   extractions for known catalog entries). Ported from the design admin-store.js
   onto the canonical service shape.
   ============================================================================ */
export interface ScrapeCatalogEntry {
  id: string; url: string; title: string; agency_text: string; agency_guess: string;
  category: string; fee_text: string; time_text: string; description: string;
  documents_raw: string[]; notes_raw: string[];
}
export interface ScrapeDoc {
  i: number; raw: string; artId: string; isNew: boolean; artName: string; bring: boolean;
  producer: string | null; suggestLink: boolean; confidence: "high" | "med" | "low"; conditional: boolean;
}
export interface ScrapeDraft {
  id: string; name: string; short: string; agency: string; cost: { model: string };
  duration: { min: number; max: number; unit: string }; desc: string; hidden: boolean;
  documents: ScrapeDoc[]; rules: { severity: string; failureMode: string; message: string; mitigation: string }[];
}

export const SCRAPE_CATALOG: ScrapeCatalogEntry[] = [
  {
    id: "building-permit",
    url: "irembo.gov.rw/home/services/construction-permit",
    title: "Construction (Building) Permit",
    agency_text: "District One-Stop Center — in partnership with Rwanda Housing Authority",
    agency_guess: "district",
    category: "Construction & housing",
    fee_text: "Varies with construction value (0.1%–1% of estimated cost)",
    time_text: "Approx. 30 working days",
    description: "Authorization required before constructing, extending or modifying a building. Submitted through the district one-stop center.",
    documents_raw: [
      "Valid identification document (National ID)",
      "Proof of land ownership (land title / UPI)",
      "Architectural and structural drawings stamped by a registered architect",
      "Land tax clearance certificate",
      "Environmental Impact Assessment report (for large-scale projects)",
    ],
    notes_raw: [
      "Building on land not zoned for the use is refused.",
      "Drawings must be stamped by an architect registered with the institute.",
    ],
  },
  {
    id: "vehicle-registration",
    url: "irembo.gov.rw/home/services/vehicle-registration",
    title: "Motor Vehicle Registration",
    agency_text: "Rwanda Revenue Authority (RRA)",
    agency_guess: "rra",
    category: "Transport",
    fee_text: "Registration fee + plate fee (by vehicle category)",
    time_text: "1–5 working days",
    description: "Register a newly purchased or imported motor vehicle and obtain number plates.",
    documents_raw: [
      "Valid National ID",
      "Proof of customs clearance / import declaration",
      "Bill of sale or proof of purchase",
      "Insurance certificate",
    ],
    notes_raw: ["Unpaid import duties block registration."],
  },
];

function matchArtifact(state: AdminState, raw: string): { artId: string | null; isNew: boolean } {
  const t = raw.toLowerCase();
  const table: { k: string[]; art: string }[] = [
    { k: ["national id", "identification document", "identity"], art: "national-id" },
    { k: ["land title", "land ownership", "upi", "title"], art: "land-title" },
    { k: ["tax clearance"], art: "tax-clearance" },
    { k: ["sale", "bill of sale", "purchase"], art: "sale-agreement" },
  ];
  for (const row of table) {
    if (row.k.some((kw) => t.includes(kw)) && state.artifacts[row.art]) return { artId: row.art, isNew: false };
  }
  return { artId: null, isNew: true };
}

export function scrape(state: AdminState, url: string): { raw: ScrapeCatalogEntry; draft: ScrapeDraft } {
  const entry =
    SCRAPE_CATALOG.find((e) => url && url.toLowerCase().includes(e.id)) ||
    SCRAPE_CATALOG.find((e) => url && url.toLowerCase().includes(e.url.split("/").pop() || "")) ||
    SCRAPE_CATALOG[0];

  const documents: ScrapeDoc[] = entry.documents_raw.map((raw, i) => {
    const m = matchArtifact(state, raw);
    let producer: string | null = null, suggestLink = false, confidence: ScrapeDoc["confidence"] = "low";
    if (!m.isNew) {
      producer = producerOf(state, m.artId as string);
      if (producer) { suggestLink = true; confidence = "high"; } else confidence = "med";
    }
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28);
    const conditional = /large-scale|for large|optional|where applicable|if /.test(raw.toLowerCase());
    return {
      i, raw,
      artId: m.artId || `new:${slug}`,
      isNew: m.isNew,
      artName: m.isNew ? raw.replace(/\(.*?\)/g, "").trim() : state.artifacts[m.artId as string].name,
      bring: m.isNew, producer, suggestLink, confidence, conditional,
    };
  });

  return {
    raw: entry,
    draft: {
      id: entry.id,
      name: entry.title,
      short: entry.title.replace(/\(.*?\)/g, "").trim().split(" ").slice(0, 2).join(" "),
      agency: entry.agency_guess,
      cost: { model: /free/i.test(entry.fee_text) ? "free" : "fee" },
      duration: { min: 1, max: parseInt((entry.time_text.match(/\d+/) || ["30"])[0], 10), unit: "day" },
      desc: entry.description,
      hidden: false,
      documents,
      rules: entry.notes_raw.map((msg) => ({ severity: "medium", failureMode: "rejection", message: msg, mitigation: "" })),
    },
  };
}
