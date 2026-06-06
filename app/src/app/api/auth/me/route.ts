import { NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = sessionFromRequest(req);
  return NextResponse.json({ user: s });
}
