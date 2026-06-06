import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";

export const dynamic = "force-dynamic";

// Bootstrap for the admin UI: services (+ lifecycle meta), artifacts, journeys.
export async function GET() {
  const repo = getRepo();
  const [services, artifacts, journeys] = await Promise.all([
    repo.listServices(), repo.listArtifacts(), repo.listJourneys(),
  ]);
  return NextResponse.json({ services, artifacts, journeys });
}
