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
