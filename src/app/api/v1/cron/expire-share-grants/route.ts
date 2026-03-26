import { NextRequest, NextResponse } from "next/server";
import { expireStaleShareGrants } from "@/lib/collaborative-share-service";

/**
 * POST /api/v1/cron/expire-share-grants
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await expireStaleShareGrants();
  return NextResponse.json({ ok: true, expired: count });
}
