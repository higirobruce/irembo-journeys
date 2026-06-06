/* M4 — DB seed (scaffold). Loads the canonical dataset.json into Postgres.
   Run (after migrate): npx prisma db seed
   Excluded from the Next type-check (tsconfig "exclude") until @prisma/client is generated. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
// import { PrismaClient } from "@prisma/client"; // enable after `prisma generate`

type Any = Record<string, unknown>;
const dataset = JSON.parse(readFileSync(join(process.cwd(), "data/dataset.json"), "utf8")) as Any;

async function main() {
  // const db = new PrismaClient();
  const agencies = dataset.agencies as Any[];
  const artifacts = dataset.artifacts as Any[];
  const services = dataset.services as Any[];
  const journeys = dataset.journeys as Any[];

  console.log(`Seeding: ${agencies.length} agencies · ${artifacts.length} artifacts · ${services.length} services · ${journeys.length} journeys`);

  // TODO (M4 proper): upsert each into the DB, e.g.
  //   for (const a of agencies) await db.agency.upsert({ where: { id: a.id }, update: a, create: a });
  //   for (const s of services) await db.service.upsert({ where:{id:s.id}, update: mapService(s), create: mapService(s) });
  //   ...where mapService flattens cost.model/duration{} and carries _meta -> status/source/note.

  console.log("Seed scaffold ran (no DB writes yet — wire PrismaClient to persist).");
}

main().catch((e) => { console.error(e); process.exit(1); });
