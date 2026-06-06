import { NextResponse } from "next/server";
import { getRepo, type ServiceRecord } from "@/lib/server/repo";
import { requirePermission } from "@/lib/server/auth";
import type { Artifact } from "@engine/types";

export const dynamic = "force-dynamic";

// POST { svc, newArtifacts } -> imports as "Needs review".
export async function POST(req: Request) {
  const guard = requirePermission(req, "edit");
  if (!guard.ok) return guard.res;
  const { svc, newArtifacts } = (await req.json()) as { svc: ServiceRecord; newArtifacts?: Record<string, Artifact> };
  if (!svc?.id) return NextResponse.json({ error: "svc.id required" }, { status: 400 });
  const rec: ServiceRecord = { ...svc, _meta: { ...svc._meta, status: "review", source: "irembo" } };
  const saved = await getRepo().importService(rec, newArtifacts || {});
  return NextResponse.json({ service: saved }, { status: 201 });
}
