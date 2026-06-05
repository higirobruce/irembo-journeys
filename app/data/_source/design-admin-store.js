/* ============================================================================
   Admin store — wraps DATA with editable admin metadata + localStorage,
   plus the simulated Irembo scrape source.
   Exposed on window.ADMIN.
   ============================================================================ */
(function () {
  const { SERVICES, ARTIFACTS, JOURNEYS, AGENCIES } = window.DATA;
  const LS_KEY = "irembo.admin.v1";

  // ---- seed admin metadata for the existing services ----------------------
  // Most are published & sourced from Irembo. A handful seed the review queue
  // and draft states so the workflow has something to act on.
  const SEED = {
    "sector":   { status: "review", source: "irembo", updated: "2026-06-02", note: "Re-scraped — hygiene fee schedule changed" },
    "ebm":      { status: "review", source: "irembo", updated: "2026-06-01", note: "New EBM 2.1 device requirement detected" },
    "coowner":  { status: "draft",  source: "manual", updated: "2026-05-28", note: "Consent rules need legal review" },
    "foreigner-impediment": { status: "review", source: "manual", updated: "2026-05-30", note: "Embassy list incomplete" },
    "matrimonial-regime":   { status: "draft", source: "manual", updated: "2026-05-21", note: "Awaiting notary fee confirmation" },
  };

  function freshMeta(id) {
    if (SEED[id]) return { ...SEED[id] };
    // deterministic-ish defaults
    const svc = SERVICES[id];
    return {
      status: "published",
      source: svc && svc.ag === "self" ? "manual" : "irembo",
      updated: "2026-05-12",
      note: "",
    };
  }

  // ---- persistence --------------------------------------------------------
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch (e) { return null; }
  }
  function save(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function clear() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  // build initial state: services (data + meta), artifacts (clone), counters
  function initialState() {
    const saved = load();
    if (saved && saved.services) return saved;
    const services = {};
    Object.keys(SERVICES).forEach((id) => {
      services[id] = { ...deepClone(SERVICES[id]), _meta: freshMeta(id) };
    });
    return {
      services,
      artifacts: deepClone(ARTIFACTS),
      journeys: deepClone(JOURNEYS),
      v: 1,
    };
  }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---- derived helpers ----------------------------------------------------
  function journeysUsing(state, id) {
    return Object.entries(state.journeys)
      .filter(([, j]) => j.steps.includes(id))
      .map(([jid, j]) => ({ id: jid, title: j.title }));
  }
  function producerOf(state, artId) {
    const hit = Object.entries(state.services).find(([, s]) => (s.pro || []).includes(artId));
    return hit ? hit[0] : null;
  }
  function statusCounts(state) {
    const c = { published: 0, review: 0, draft: 0 };
    Object.values(state.services).forEach((s) => { c[s._meta.status] = (c[s._meta.status] || 0) + 1; });
    return c;
  }

  // ============================================================================
  //  SIMULATED IREMBO SCRAPE
  //  Live scraping can't run in a prototype (browser blocks cross-origin reads),
  //  so this returns a realistic raw extraction for known catalog entries.
  // ============================================================================

  // a small mock catalog the admin can "discover" by URL
  const SCRAPE_CATALOG = [
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
      notes_raw: [
        "Unpaid import duties block registration.",
      ],
    },
  ];

  // map a raw document string to a known artifact id, or flag as NEW
  function matchArtifact(state, raw) {
    const t = raw.toLowerCase();
    const table = [
      { k: ["national id", "identification document", "identity"], art: "national-id" },
      { k: ["land title", "land ownership", "upi", "title"], art: "land-title" },
      { k: ["tax clearance"], art: "tax-clearance" },
      { k: ["sale", "bill of sale", "purchase"], art: "sale-agreement" },
    ];
    for (const row of table) {
      if (row.k.some((kw) => t.includes(kw)) && state.artifacts[row.art]) {
        return { artId: row.art, isNew: false };
      }
    }
    return { artId: null, isNew: true };
  }

  // run the simulated scrape -> structured draft + dependency suggestions
  function scrape(state, url) {
    const entry = SCRAPE_CATALOG.find((e) => url && url.toLowerCase().includes(e.id))
      || SCRAPE_CATALOG.find((e) => url && url.toLowerCase().includes(e.url.split("/").pop()))
      || SCRAPE_CATALOG[0];

    const documents = entry.documents_raw.map((raw, i) => {
      const m = matchArtifact(state, raw);
      let producer = null, suggestLink = false, confidence = "low";
      if (!m.isNew) {
        producer = producerOf(state, m.artId);
        if (producer) { suggestLink = true; confidence = "high"; }
        else confidence = "med";
      }
      // proposed new artifact id from the text
      const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28);
      const conditional = /large-scale|for large|optional|where applicable|if /.test(raw.toLowerCase());
      return {
        i, raw,
        artId: m.artId || `new:${slug}`,
        isNew: m.isNew,
        artName: m.isNew ? raw.replace(/\(.*?\)/g, "").trim() : state.artifacts[m.artId].name,
        bring: m.isNew, // new artifacts assumed citizen-arranged unless linked
        producer, suggestLink, confidence, conditional,
      };
    });

    return {
      raw: entry,
      draft: {
        id: entry.id,
        name: entry.title,
        short: entry.title.replace(/\(.*?\)/g, "").trim().split(" ").slice(0, 2).join(" "),
        ag: entry.agency_guess,
        cost: /free/i.test(entry.fee_text) ? "free" : "fee",
        du: "day",
        dmin: 1,
        dmax: parseInt((entry.time_text.match(/\d+/) || [30])[0], 10),
        desc: entry.description,
        hidden: false,
        documents,
        rules: entry.notes_raw.map((msg) => ({ sev: "med", mode: "rejection", msg, tip: "" })),
      },
    };
  }

  window.ADMIN = {
    LS_KEY, initialState, save, load, clear, deepClone,
    journeysUsing, producerOf, statusCounts, scrape,
    SCRAPE_CATALOG, freshMeta,
  };
})();
