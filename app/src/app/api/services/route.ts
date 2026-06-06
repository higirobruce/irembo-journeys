import { NextResponse } from "next/server";
import { getRepo, type ServiceRecord } from "@/lib/server/repo";
import { requirePermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ services: await getRepo().listServices() });
}

export async function POST(req: Request) {
  const guard = requirePermission(req, "edit");
  if (!guard.ok) return guard.res;
  const body = (await req.json()) as ServiceRecord;
  if (!body?.id || !body?.name) return NextResponse.json({ error: "id and name required" }, { status: 400 });
  const m = body._meta || ({} as ServiceRecord["_meta"]);
  const saved = await getRepo().upsertService({ ...body, _meta: { status: m.status ?? "draft", source: m.source ?? "manual", note: m.note, updated: m.updated } });
  return NextResponse.json({ service: saved }, { status: 201 });
}
