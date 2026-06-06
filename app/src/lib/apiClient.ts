"use client";
/* Client-side API helper for the admin UI. Auth is now the signed session cookie
   (sent automatically with same-origin fetch) — no role header. */
import type { ServiceRecord, Status } from "@/lib/server/repo";
import type { Artifact, Journey } from "@engine/types";
import type { ScrapeResult } from "@/lib/server/scraper";
import type { Role } from "@/lib/server/session";

const headers = { "content-type": "application/json" };

async function jsonOrThrow(r: Response) {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
  return body;
}

export interface Me { email: string; name?: string; role: Role }
export async function me(): Promise<Me | null> {
  const d = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
  return d.user || null;
}
export async function login(role: Role, name?: string): Promise<Me> {
  return (await jsonOrThrow(await fetch("/api/auth/login", { method: "POST", headers, body: JSON.stringify({ role, name }) }))).user;
}
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function fetchState(): Promise<{ services: ServiceRecord[]; artifacts: Artifact[]; journeys: Journey[] }> {
  return jsonOrThrow(await fetch("/api/state", { cache: "no-store" }));
}
export async function saveService(svc: ServiceRecord): Promise<ServiceRecord> {
  return (await jsonOrThrow(await fetch("/api/services", { method: "POST", headers, body: JSON.stringify(svc) }))).service;
}
export async function setStatus(id: string, status: Status): Promise<ServiceRecord> {
  return (await jsonOrThrow(await fetch(`/api/services/${id}/status`, { method: "POST", headers, body: JSON.stringify({ status }) }))).service;
}
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  return jsonOrThrow(await fetch("/api/import/scrape", { method: "POST", headers, body: JSON.stringify({ url }) }));
}
export async function importService(svc: ServiceRecord, newArtifacts: Record<string, Artifact>): Promise<ServiceRecord> {
  return (await jsonOrThrow(await fetch("/api/import", { method: "POST", headers, body: JSON.stringify({ svc, newArtifacts }) }))).service;
}
