import { NextResponse } from "next/server";
import { getRepo, type Status } from "@/lib/server/repo";
import { requirePermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Promote a service through the lifecycle. publish -> Publisher; review/draft -> Reviewer+.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as { status?: Status };
  const status = body.status;
  if (status !== "draft" && status !== "review" && status !== "published")
    return NextResponse.json({ error: "status must be draft|review|published" }, { status: 400 });
  const guard = requirePermission(req, status === "published" ? "publish" : "approve");
  if (!guard.ok) return guard.res;
  const s = await getRepo().setStatus(params.id, status);
  return s ? NextResponse.json({ service: s }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
