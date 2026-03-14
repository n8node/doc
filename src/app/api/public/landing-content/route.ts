import { NextResponse } from "next/server";
import { getLandingContent } from "@/lib/landing-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getLandingContent();
  return NextResponse.json(content);
}
