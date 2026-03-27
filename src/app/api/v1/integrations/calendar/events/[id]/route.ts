import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeUserId } from "@/lib/calendar-bridge-api-auth";
import {
  deleteCalendarEventRemote,
  updateCalendarEventRemote,
} from "@/lib/calendar-bridge/calendar-operations";
import { eventToJson } from "@/lib/calendar-bridge/api-json";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCalendarBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await prisma.calendarBridgeEvent.findFirst({
    where: {
      id,
      subscription: { account: { userId } },
    },
    include: {
      subscription: { select: { resourceHref: true, displayName: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ event: eventToJson(row) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCalendarBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    summary?: string;
    startAt?: Date;
    endAt?: Date;
    allDay?: boolean;
    location?: string | null;
    description?: string | null;
  } = {};

  if (typeof body.summary === "string") patch.summary = body.summary;
  if (typeof body.startAt === "string") {
    const d = new Date(body.startAt);
    if (!Number.isNaN(d.getTime())) patch.startAt = d;
  }
  if (typeof body.endAt === "string") {
    const d = new Date(body.endAt);
    if (!Number.isNaN(d.getTime())) patch.endAt = d;
  }
  if (body.allDay === true || body.allDay === false) patch.allDay = body.allDay;
  if (typeof body.location === "string") patch.location = body.location;
  if (body.location === null) patch.location = null;
  if (typeof body.description === "string") patch.description = body.description;
  if (body.description === null) patch.description = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Укажите хотя бы одно поле для изменения" }, { status: 400 });
  }

  if (patch.startAt && patch.endAt && patch.endAt.getTime() <= patch.startAt.getTime()) {
    return NextResponse.json({ error: "endAt должен быть позже startAt" }, { status: 400 });
  }

  const result = await updateCalendarEventRemote({
    userId,
    eventId: id,
    ...patch,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const row = await prisma.calendarBridgeEvent.findFirst({
    where: { id },
    include: {
      subscription: { select: { resourceHref: true, displayName: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found after update" }, { status: 500 });
  }

  return NextResponse.json({ event: eventToJson(row) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getCalendarBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteCalendarEventRemote(userId, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
