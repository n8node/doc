import { NextResponse } from "next/server";
import { getBrandingConfig } from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getBrandingConfig();
  return NextResponse.json(config);
}
