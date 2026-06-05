/* M4 — server-side Irembo scraper (D3: pure HTML scraping, beside not API).
   SCAFFOLD: `fetchPage` currently returns a known catalog entry (simulation).
   The real implementation fetches the URL server-side and parses the DOM with
   selectors-as-config (same anti-fragility pattern as extension/adapters.json).
   The parsing + dependency auto-linking below are real and run against the repo. */
import type { DataRepo } from "./repo";

export interface RawPage {
  url: string; title: string; agency_text: string; agency_guess: string;
  fee_text: string; time_text: string; description: string;
  documents_raw: string[]; notes_raw: string[];
}

const CATALOG: RawPage[] = [
  {
    url: "irembo.gov.rw/home/services/construction-permit",
    title: "Construction (Building) Permit",
    agency_text: "District One-Stop Center — in partnership with Rwanda Housing Authority",
    agency_guess: "district",
    fee_text: "Varies with construction value (0.1%–1% of estimated cost)",
    time_text: "Approx. 30 working days",
    description: "Authorization required before constructing, extending or modifying a building.",
    documents_raw: [
      "Valid identification document (National ID)",
      "Proof of land ownership (land title / UPI)",
      "Architectural and structural drawings stamped by a registered architect",
      "Land tax clearance certificate",
      "Environmental Impact Assessment report (for large-scale projects)",
    ],
    notes_raw: ["Building on land not zoned for the use is refused.", "Drawings must be stamped by a registered architect."],
  },
  {
    url: "irembo.gov.rw/home/services/vehicle-registration",
    title: "Motor Vehicle Registration",
    agency_text: "Rwanda Revenue Authority (RRA)", agency_guess: "rra",
    fee_text: "Registration fee + plate fee (by vehicle category)", time_text: "1–5 working days",
    description: "Register a newly purchased or imported motor vehicle and obtain number plates.",
    documents_raw: ["Valid National ID", "Proof of customs clearance / import declaration", "Bill of sale or proof of purchase", "Insurance certificate"],
    notes_raw: ["Unpaid import duties block registration."],
  },
];

// PRODUCTION SEAM: replace with a real server-side fetch + DOM parse (cheerio/etc).
async function fetchPage(url: string): Promise<RawPage> {
  const hit = CATALOG.find((e) => url && (url.includes(e.url) || e.url.includes(url.split("/").pop() || "§")));
  return hit || CATALOG[0];
}

const ART_TABLE: { k: string[]; art: string }[] = [
  { k: ["national id", "identification document", "identity"], art: "national-id" },
  { k: ["land title", "land ownership", "upi", "title"], art: "land-title" },
  { k: ["tax clearance"], art: "tax-clearance" },
  { k: ["sale", "bill of sale", "purchase"], art: "sale-agreement" },
];

export interface ScrapedDoc {
  raw: string; artId: string; isNew: boolean; artName: string;
  producer: string | null; suggestLink: boolean; confidence: "high" | "med" | "low"; conditional: boolean;
}
export interface ScrapeResult {
  raw: RawPage;
  draft: { name: string; short: string; agency: string; cost: { model: string }; duration: { min: number; max: number; unit: string }; desc: string; documents: ScrapedDoc[]; rules: { severity: string; failureMode: string; message: string; mitigation: string }[] };
}

export async function scrape(repo: DataRepo, url: string): Promise<ScrapeResult> {
  const page = await fetchPage(url);
  const artifacts = await repo.listArtifacts();
  const known = new Set(artifacts.map((a) => a.id));
  const nameOf = (id: string) => artifacts.find((a) => a.id === id)?.name || id;

  const documents: ScrapedDoc[] = [];
  for (const raw of page.documents_raw) {
    const t = raw.toLowerCase();
    const row = ART_TABLE.find((r) => r.k.some((kw) => t.includes(kw)) && known.has(r.art));
    if (row) {
      const producer = await repo.producerOf(row.art);
      documents.push({ raw, artId: row.art, isNew: false, artName: nameOf(row.art), producer, suggestLink: !!producer, confidence: producer ? "high" : "med", conditional: /large-scale|for large|optional|if /.test(t) });
    } else {
      const slug = t.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28);
      documents.push({ raw, artId: `new:${slug}`, isNew: true, artName: raw.replace(/\(.*?\)/g, "").trim(), producer: null, suggestLink: false, confidence: "low", conditional: /large-scale|for large|optional|if /.test(t) });
    }
  }
  return {
    raw: page,
    draft: {
      name: page.title,
      short: page.title.replace(/\(.*?\)/g, "").trim().split(" ").slice(0, 2).join(" "),
      agency: page.agency_guess,
      cost: { model: /free/i.test(page.fee_text) ? "free" : "fee" },
      duration: { min: 1, max: parseInt((page.time_text.match(/\d+/) || ["30"])[0], 10), unit: "day" },
      desc: page.description,
      documents,
      rules: page.notes_raw.map((m) => ({ severity: "medium", failureMode: "rejection", message: m, mitigation: "" })),
    },
  };
}
