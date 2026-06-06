/* M4 — server-side Irembo scraper (D3: pure HTML scraping, beside not API).
   `fetchPage` now does a REAL server-side fetch + cheerio parse for arbitrary
   Irembo URLs, with graceful fallback to curated fixtures when the URL is a known
   sample, isn't reachable, or parses empty. Selectors are best-effort and must be
   calibrated against the live DOM (same selectors-as-config idea as
   extension/adapters.json). The dependency auto-linking runs against the repo. */
import * as cheerio from "cheerio";
import type { DataRepo } from "./repo";

export interface RawPage {
  url: string; title: string; agency_text: string; agency_guess: string;
  fee_text: string; time_text: string; description: string;
  documents_raw: string[]; notes_raw: string[];
}

// curated fixtures — used for the demo sample URLs and as a fallback.
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

function guessAgency(text: string): string {
  const t = text.toLowerCase();
  if (/\brra\b|revenue authority/.test(t)) return "rra";
  if (/\brdb\b|development board/.test(t)) return "rdb";
  if (/\brlmua\b|land management|land title/.test(t)) return "rlmua";
  if (/immigration|dgie/.test(t)) return "immigration";
  if (/\bpolice\b|rnp/.test(t)) return "police";
  if (/notary/.test(t)) return "notary";
  if (/civil registrar|sector office/.test(t)) return "civil";
  if (/district|one-stop/.test(t)) return "district";
  return "self";
}

// REAL parse — best-effort selectors over the fetched HTML.
function parseHtml(url: string, html: string): RawPage {
  const $ = cheerio.load(html);
  const first = (sel: string) => $(sel).first().text().trim();
  const title = first("h1") || $('meta[property="og:title"]').attr("content")?.trim() || $("title").text().trim() || "Untitled service";
  const description = $('meta[name="description"]').attr("content")?.trim() || first("main p, article p") || "";

  const documents_raw: string[] = [];
  $("h2,h3,h4,strong,b").each((_, h) => {
    if (/document|required|requirement/i.test($(h).text())) {
      $(h).nextUntil("h2,h3,h4").find("li").each((__, li) => {
        const d = $(li).text().trim().replace(/\s+/g, " ");
        if (d && d.length < 200) documents_raw.push(d);
      });
    }
  });
  if (documents_raw.length === 0) {
    $("li").slice(0, 12).each((_, li) => {
      const d = $(li).text().trim().replace(/\s+/g, " ");
      if (d && d.length < 160) documents_raw.push(d);
    });
  }

  const body = $("body").text().replace(/\s+/g, " ");
  const fee_text = (/(free of charge|no fee|RWF\s?[\d,]+[^.\n]{0,40}|[\d.]+%[^.\n]{0,30})/i.exec(body) || [""])[0].trim();
  const time_text = (/(\d+\s*[–-]?\s*\d*\s*(working\s*)?(days?|hours?|weeks?|months?))/i.exec(body) || [""])[0].trim();

  return { url, title, agency_text: "", agency_guess: guessAgency(body), fee_text, time_text, description, documents_raw, notes_raw: [] };
}

async function fetchPage(url: string): Promise<{ page: RawPage; live: boolean }> {
  const known = CATALOG.find((e) => url && (url.includes(e.url) || e.url.includes(url.split("/").pop() || "§")));
  if (known) return { page: known, live: false }; // deterministic curated fixture for sample URLs
  const norm = url && !/^https?:\/\//i.test(url) ? "https://" + url : url;
  if (!norm || !/irembo/i.test(norm)) return { page: CATALOG[0], live: false };
  try {
    const res = await fetch(norm, { headers: { "user-agent": "IremboJourneyCompanion/0.1 (+admin scraper)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const page = parseHtml(norm, await res.text());
    if (!page.documents_raw.length && page.title === "Untitled service") throw new Error("parse yielded nothing");
    return { page, live: true };
  } catch {
    return { page: CATALOG[0], live: false }; // unreachable/blocked/parse-empty -> fixture
  }
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
  live: boolean; // true = parsed from a live fetch; false = curated fixture / fallback
  draft: { id: string; name: string; short: string; agency: string; cost: { model: string }; duration: { min: number; max: number; unit: string }; desc: string; documents: ScrapedDoc[]; rules: { severity: string; failureMode: string; message: string; mitigation: string }[] };
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32);

export async function scrape(repo: DataRepo, url: string): Promise<ScrapeResult> {
  const { page, live } = await fetchPage(url);
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
      documents.push({ raw, artId: `new:${slug(raw)}`, isNew: true, artName: raw.replace(/\(.*?\)/g, "").trim(), producer: null, suggestLink: false, confidence: "low", conditional: /large-scale|for large|optional|if /.test(t) });
    }
  }
  return {
    raw: page,
    live,
    draft: {
      id: slug(page.title.replace(/\(.*?\)/g, "")),
      name: page.title,
      short: page.title.replace(/\(.*?\)/g, "").trim().split(" ").slice(0, 2).join(" "),
      agency: page.agency_guess,
      cost: { model: /free|no fee/i.test(page.fee_text) ? "free" : "fee" },
      duration: { min: 1, max: parseInt((page.time_text.match(/\d+/) || ["30"])[0], 10), unit: "day" },
      desc: page.description,
      documents,
      rules: page.notes_raw.map((m) => ({ severity: "medium", failureMode: "rejection", message: m, mitigation: "" })),
    },
  };
}
