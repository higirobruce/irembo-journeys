import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { requirePermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// Reassemble a journey's ordered step list. Gated at "publish" — it changes the
// live citizen path.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = requirePermission(req, "publish");
  if (!guard.ok) return guard.res;
  const { steps } = (await req.json()) as { steps?: string[] };
  if (!Array.isArray(steps)) return NextResponse.json({ error: "steps[] required" }, { status: 400 });
  const j = await getRepo().updateJourneySteps(params.id, steps);
  return j ? NextResponse.json({ journey: j }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
