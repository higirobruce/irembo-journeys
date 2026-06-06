/* M4 — PrismaRepo: Postgres-backed DataRepo.
   Full implementation against prisma/schema.prisma. It is EXCLUDED from the Next
   type-check/build (tsconfig "exclude") and imported by nothing until you wire it,
   so the un-generated `@prisma/client` import below doesn't break the app build.

   TO ACTIVATE (M4 proper):
     1. npm i -D prisma tsx && npm i @prisma/client
     2. set DATABASE_URL in .env.local
     3. npx prisma migrate dev   (creates tables)
     4. npm run db:seed          (loads dataset.json — prisma/seed.ts)
     5. remove "src/lib/server/prismaRepo.ts" from tsconfig "exclude"
     6. in repo.ts getRepo(): if DATA_BACKEND==="prisma" return new PrismaRepo()
     7. set DATA_BACKEND=prisma

   The mapping layer bridges the flattened DB columns <-> the canonical
   ServiceRecord shape the rest of the app uses. Keep these signatures matching
   the DataRepo interface in repo.ts. */
import { PrismaClient, Prisma } from "@prisma/client";
import type { DataRepo, ServiceRecord, Status, Meta } from "./repo";
import type { Artifact, Journey, Rule, Condition } from "@engine/types";

// reuse one client across hot-reloads in dev
const g = globalThis as unknown as { __prisma?: PrismaClient };
const db = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = db;

type ServiceRow = Prisma.ServiceGetPayload<{}>;

// ---- mappers: DB row <-> canonical ServiceRecord -----------------------------
function toRecord(row: ServiceRow): ServiceRecord {
  return {
    id: row.id,
    name: row.name,
    short: row.short ?? undefined,
    agency: row.agencyId,
    desc: row.desc ?? undefined,
    requires: row.requires,
    produces: row.produces,
    cost: { model: row.costModel },
    duration: { min: row.durMin, max: row.durMax, unit: row.durUnit as ServiceRecord["duration"]["unit"] },
    hidden: row.hidden,
    appliesWhen: (row.appliesWhen as Condition | null) ?? null,
    rules: (row.rules as unknown as Rule[]) ?? [],
    _meta: {
      status: row.status as Meta["status"],
      source: row.source as Meta["source"],
      updated: row.updatedAt ? new Date(row.updatedAt).toISOString().slice(0, 10) : undefined,
      note: row.note ?? undefined,
    },
  };
}

function toRow(svc: ServiceRecord): Prisma.ServiceUncheckedCreateInput {
  return {
    id: svc.id,
    name: svc.name,
    short: svc.short ?? null,
    agencyId: svc.agency,
    desc: svc.desc ?? null,
    requires: svc.requires ?? [],
    produces: svc.produces ?? [],
    costModel: svc.cost?.model ?? "free",
    durMin: svc.duration?.min ?? 0,
    durMax: svc.duration?.max ?? 0,
    durUnit: svc.duration?.unit ?? "day",
    hidden: !!svc.hidden,
    appliesWhen: (svc.appliesWhen ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    rules: (svc.rules ?? []) as unknown as Prisma.InputJsonValue,
    status: (svc._meta?.status ?? "draft") as Status,
    source: (svc._meta?.source ?? "manual") as Meta["source"],
    note: svc._meta?.note ?? null,
  };
}

function artRow(a: Artifact) {
  return { id: a.id, name: a.name, bring: !!a.bring, issuedBy: a.issuedBy ?? null };
}

export class PrismaRepo implements DataRepo {
  async listServices(): Promise<ServiceRecord[]> {
    const rows = await db.service.findMany({ orderBy: { name: "asc" } });
    return rows.map(toRecord);
  }
  async getService(id: string): Promise<ServiceRecord | null> {
    const row = await db.service.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }
  async upsertService(svc: ServiceRecord): Promise<ServiceRecord> {
    const data = toRow(svc);
    const row = await db.service.upsert({ where: { id: svc.id }, create: data, update: data });
    return toRecord(row);
  }
  async setStatus(id: string, status: Status): Promise<ServiceRecord | null> {
    try {
      const row = await db.service.update({ where: { id }, data: { status: status as Status } });
      return toRecord(row);
    } catch {
      return null; // record not found
    }
  }
  async listArtifacts(): Promise<Artifact[]> {
    const rows = await db.artifact.findMany();
    return rows.map((a) => ({ id: a.id, name: a.name, bring: a.bring, issuedBy: a.issuedBy ?? undefined }));
  }
  async listJourneys(): Promise<Journey[]> {
    const rows = await db.journey.findMany();
    return rows.map((j) => ({
      id: j.id, name: j.name, blurb: j.blurb ?? undefined, icon: j.icon ?? undefined,
      goalPhrases: j.goalPhrases, outcomeArtifacts: j.outcomeArtifacts,
      steps: j.steps.map((service, order) => ({ order, service })),
    }));
  }
  async producerOf(artifactId: string): Promise<string | null> {
    const row = await db.service.findFirst({ where: { produces: { has: artifactId } }, select: { id: true } });
    return row?.id ?? null;
  }
  async importService(svc: ServiceRecord, newArtifacts: Record<string, Artifact>): Promise<ServiceRecord> {
    const artifactOps = Object.values(newArtifacts).map((a) =>
      db.artifact.upsert({ where: { id: a.id }, create: artRow(a), update: { name: a.name, bring: !!a.bring } })
    );
    const data = toRow(svc);
    const serviceOp = db.service.upsert({ where: { id: svc.id }, create: data, update: data });
    const res = await db.$transaction([...artifactOps, serviceOp]);
    return toRecord(res[res.length - 1] as ServiceRow);
  }
}
