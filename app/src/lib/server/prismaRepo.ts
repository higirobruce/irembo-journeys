/* M4 — PrismaRepo SKELETON (Postgres-backed DataRepo).
   Intentionally NOT imported by the build yet, and free of @prisma/client imports
   so it type-checks before `prisma generate` runs. Wiring steps (M4 proper):
     1. npm i -D prisma && npm i @prisma/client
     2. npx prisma migrate dev   (creates tables from prisma/schema.prisma)
     3. npx prisma db seed        (loads dataset.json — see prisma/seed.ts)
     4. replace the bodies below with PrismaClient queries
     5. in repo.ts getRepo(): if DATA_BACKEND === "prisma" return new PrismaRepo()
   The DataRepo interface is the contract — keep these signatures identical. */
import type { DataRepo, ServiceRecord, Status } from "./repo";
import type { Artifact, Journey } from "@engine/types";

const TODO = (m: string): never => { throw new Error(`PrismaRepo.${m} not implemented — see M4 wiring steps in prismaRepo.ts`); };

export class PrismaRepo implements DataRepo {
  // private db = new PrismaClient();  // enable after `prisma generate`
  async listServices(): Promise<ServiceRecord[]> { return TODO("listServices"); }
  async getService(_id: string): Promise<ServiceRecord | null> { return TODO("getService"); }
  async upsertService(_svc: ServiceRecord): Promise<ServiceRecord> { return TODO("upsertService"); }
  async setStatus(_id: string, _status: Status): Promise<ServiceRecord | null> { return TODO("setStatus"); }
  async listArtifacts(): Promise<Artifact[]> { return TODO("listArtifacts"); }
  async listJourneys(): Promise<Journey[]> { return TODO("listJourneys"); }
  async producerOf(_artifactId: string): Promise<string | null> { return TODO("producerOf"); }
  async importService(_svc: ServiceRecord, _newArtifacts: Record<string, Artifact>): Promise<ServiceRecord> { return TODO("importService"); }
}
