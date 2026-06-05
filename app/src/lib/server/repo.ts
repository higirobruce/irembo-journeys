/* M4 data layer — repository abstraction.
   The API talks to a DataRepo; the concrete impl is selected by DATA_BACKEND.
   - JsonRepo  (default): reads the canonical dataset.json + an in-memory overlay
                for mutations. Works today with no database.
   - PrismaRepo (stub):   the Postgres-backed impl, wired in M4 proper.
   This seam lets the API + admin be built and tested before the DB exists. */
import datasetJson from "@data/dataset.json";
import type { Dataset, Service, Artifact, Journey } from "@engine/types";

export type Status = "draft" | "review" | "published";
export interface Meta { status: Status; source: "irembo" | "manual"; updated?: string; note?: string }
export type ServiceRecord = Service & { _meta: Meta };

export interface DataRepo {
  listServices(): Promise<ServiceRecord[]>;
  getService(id: string): Promise<ServiceRecord | null>;
  upsertService(svc: ServiceRecord): Promise<ServiceRecord>;
  setStatus(id: string, status: Status): Promise<ServiceRecord | null>;
  listArtifacts(): Promise<Artifact[]>;
  listJourneys(): Promise<Journey[]>;
  producerOf(artifactId: string): Promise<string | null>;
  importService(svc: ServiceRecord, newArtifacts: Record<string, Artifact>): Promise<ServiceRecord>;
}

const dataset = datasetJson as unknown as Dataset;
const today = () => new Date().toISOString().slice(0, 10);

class JsonRepo implements DataRepo {
  private services = new Map<string, ServiceRecord>();
  private artifacts = new Map<string, Artifact>();
  constructor() {
    dataset.services.forEach((s) => this.services.set(s.id, structuredClone(s) as ServiceRecord));
    dataset.artifacts.forEach((a) => this.artifacts.set(a.id, structuredClone(a)));
  }
  async listServices() { return [...this.services.values()]; }
  async getService(id: string) { return this.services.get(id) ?? null; }
  async upsertService(svc: ServiceRecord) {
    const rec = { ...svc, _meta: { ...svc._meta, updated: today() } };
    this.services.set(svc.id, rec); return rec;
  }
  async setStatus(id: string, status: Status) {
    const s = this.services.get(id); if (!s) return null;
    const rec = { ...s, _meta: { ...s._meta, status, updated: today() } };
    this.services.set(id, rec); return rec;
  }
  async listArtifacts() { return [...this.artifacts.values()]; }
  async listJourneys() { return dataset.journeys; }
  async producerOf(artifactId: string) {
    for (const s of this.services.values()) if ((s.produces || []).includes(artifactId)) return s.id;
    return null;
  }
  async importService(svc: ServiceRecord, newArtifacts: Record<string, Artifact>) {
    Object.values(newArtifacts).forEach((a) => this.artifacts.set(a.id, a));
    return this.upsertService(svc);
  }
}

let _repo: DataRepo | null = null;
export function getRepo(): DataRepo {
  if (_repo) return _repo;
  // DATA_BACKEND=prisma will select PrismaRepo once the DB is provisioned (M4 proper).
  _repo = new JsonRepo();
  return _repo;
}
