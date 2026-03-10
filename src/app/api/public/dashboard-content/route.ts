import { NextResponse } from "next/server";
import { getDashboardContent } from "@/lib/dashboard-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getDashboardContent();
  return NextResponse.json(content);
}
