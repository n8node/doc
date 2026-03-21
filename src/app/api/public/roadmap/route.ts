import { NextResponse } from "next/server";
import { getRoadmapSteps } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export async function GET() {
  const steps = await getRoadmapSteps();
  return NextResponse.json({ steps });
}
