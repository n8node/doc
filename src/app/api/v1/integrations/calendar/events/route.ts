import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCalendarBridgeUserId } from "@/lib/calendar-bridge-api-auth";

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
    events: events.map((e) => ({
      id: e.id,
      uid: e.uid,
      recurrenceId: e.recurrenceId,
      summary: e.summary,
      location: e.location,
      description: e.description,
      startAt: e.startAt?.toISOString() ?? null,
      endAt: e.endAt?.toISOString() ?? null,
      allDay: e.allDay,
      subscriptionId: e.subscriptionId,
      calendar: {
        resourceHref: e.subscription.resourceHref,
        displayName: e.subscription.displayName,
      },
    })),
  });
}
