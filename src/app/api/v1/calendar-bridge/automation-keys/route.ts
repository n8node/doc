import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";
import { createCalendarBridgeApiKey } from "@/lib/calendar-bridge-api-auth";

export async function GET() {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await prisma.calendarBridgeApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const name = typeof body.name === "string" ? body.name : "n8n";

  const created = await createCalendarBridgeApiKey(userId, name);
  return NextResponse.json({
    id: created.id,
    name: created.name,
    key: created.key,
    keyPrefix: created.keyPrefix,
  });
}
