import { NextResponse } from "next/server";
import { getRepo, type ServiceRecord } from "@/lib/server/repo";
import { requirePermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const s = await getRepo().getService(params.id);
  return s ? NextResponse.json({ service: s }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = requirePermission(req, "edit");
  if (!guard.ok) return guard.res;
  const cur = await getRepo().getService(params.id);
  if (!cur) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = (await req.json()) as Partial<ServiceRecord>;
  const saved = await getRepo().upsertService({ ...cur, ...patch, id: params.id });
  return NextResponse.json({ service: saved });
}
