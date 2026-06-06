"use client";
/* Client-side API helper for the admin UI. Talks to the M4 route handlers
   (backed by JsonRepo today, Postgres later — no UI change). Auth is the dev
   stub: role via x-user-role header. Replace ROLE with the real session later. */
import type { ServiceRecord, Status } from "@/lib/server/repo";
import type { Artifact, Journey } from "@engine/types";
import type { ScrapeResult } from "@/lib/server/scraper";

const ROLE = "publisher";
const headers = { "content-type": "application/json", "x-user-role": ROLE };

async function jsonOrThrow(r: Response) {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || `${r.status} ${r.statusText}`);
  return body;
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
