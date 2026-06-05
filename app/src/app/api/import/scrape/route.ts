import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { scrape } from "@/lib/server/scraper";
import { requirePermission } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

// POST { url } -> scraped draft + auto-suggested dependency links.
export async function POST(req: Request) {
  const guard = requirePermission(req, "edit");
  if (!guard.ok) return guard.res;
  const { url } = (await req.json()) as { url?: string };
  const result = await scrape(getRepo(), url || "");
  return NextResponse.json(result);
}
