import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeUserId } from "@/lib/calendar-bridge-api-auth";
import { createCalendarEventRemote } from "@/lib/calendar-bridge/calendar-operations";
import { eventToJson } from "@/lib/calendar-bridge/api-json";

export async function GET(req: NextRequest) {
  const userId = await getCalendarBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const subIds = searchParams.get("subscriptionIds");

  const now = new Date();
  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const to = toParam ? new Date(toParam) : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
  }

  const subscriptionIdFilter =
    subIds && subIds.trim()
      ? {
          in: subIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : undefined;

  const events = await prisma.calendarBridgeEvent.findMany({
    where: {
      subscription: {
        account: { userId },
        enabled: true,
        ...(subscriptionIdFilter ? { id: subscriptionIdFilter } : {}),
      },
      OR: [
        {
          startAt: { gte: from, lte: to },
        },
        {
          endAt: { gte: from, lte: to },
        },
        {
          AND: [{ startAt: { lte: from } }, { endAt: { gte: to } }],
        },
      ],
    },
    orderBy: { startAt: "asc" },
    include: {
      subscription: {
        select: {
          id: true,
          resourceHref: true,
          displayName: true,
        },
      },
    },
    take: 500,
  });

  return NextResponse.json({
    events: events.map((e) => eventToJson(e)),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCalendarBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subscriptionId = typeof body.subscriptionId === "string" ? body.subscriptionId.trim() : "";
  const summary = typeof body.summary === "string" ? body.summary : "";
  const startAt = typeof body.startAt === "string" ? new Date(body.startAt) : null;
  const endAt = typeof body.endAt === "string" ? new Date(body.endAt) : null;
  const allDay = body.allDay === true;
  const location = typeof body.location === "string" ? body.location : body.location === null ? null : undefined;
  const description =
    typeof body.description === "string" ? body.description : body.description === null ? null : undefined;

  if (!subscriptionId || !startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return NextResponse.json(
      { error: "Нужны subscriptionId, startAt и endAt (ISO 8601)" },
      { status: 400 }
    );
  }
  if (endAt.getTime() <= startAt.getTime()) {
    return NextResponse.json({ error: "endAt должен быть позже startAt" }, { status: 400 });
  }

  const result = await createCalendarEventRemote({
    userId,
    subscriptionId,
    summary,
    startAt,
    endAt,
    allDay,
    location,
    description,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const row = await prisma.calendarBridgeEvent.findFirst({
    where: { id: result.eventId },
    include: {
      subscription: { select: { resourceHref: true, displayName: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Событие не найдено после создания" }, { status: 500 });
  }

  return NextResponse.json({ event: eventToJson(row) }, { status: 201 });
}
