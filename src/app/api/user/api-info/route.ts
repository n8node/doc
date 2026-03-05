import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";

function getBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
  if (fromEnv && !fromEnv.includes("localhost")) return fromEnv.replace(/\/$/, "");

  const proto =
    request.headers.get("x-forwarded-proto") ||
    request.headers.get("x-forwarded-protocol") ||
    "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  if (host)
    return `${proto === "https" ? "https" : "http"}://${host}`.replace(/\/$/, "");

  return "https://qoqon.ru";
}

/**
 * GET /api/user/api-info — base URL for API calls (session or API key)
 */
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = getBaseUrl(req);
  return NextResponse.json({ baseUrl });
}
