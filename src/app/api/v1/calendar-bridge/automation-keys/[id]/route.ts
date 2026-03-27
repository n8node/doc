import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeSessionUserId } from "@/lib/calendar-bridge/session";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCalendarBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const row = await prisma.calendarBridgeApiKey.findFirst({
    where: { id, userId },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.calendarBridgeApiKey.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
