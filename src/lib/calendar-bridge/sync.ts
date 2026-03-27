import { fetchCalendarObjects } from "tsdav";
import type { DAVCalendar } from "tsdav";
import { prisma } from "@/lib/prisma";
import { decryptYandexCredentials } from "./credentials";
import { createYandexDavClient, findCalendarByUrl } from "./dav-client";
import { parseFirstVevent } from "./parse-ics";

function displayNameFromCalendar(cal: DAVCalendar): string | null {
  const d = cal.displayName;
  if (typeof d === "string") return d;
  return null;
}

export async function syncCalendarBridgeAccount(accountId: string): Promise<{
  ok: boolean;
  error?: string;
  eventsUpserted?: number;
}> {
  const account = await prisma.calendarBridgeAccount.findFirst({
    where: { id: accountId },
    include: {
      subscriptions: { where: { enabled: true } },
    },
  });
  if (!account) return { ok: false, error: "Account not found" };
  if (account.subscriptions.length === 0) {
    await prisma.calendarBridgeAccount.update({
      where: { id: accountId },
      data: {
        lastSyncedAt: new Date(),
        status: "active",
        lastError: null,
      },
    });
    return { ok: true, eventsUpserted: 0 };
  }

  let creds;
  try {
    creds = decryptYandexCredentials(account.encryptedCredentials);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Credentials error";
    await prisma.calendarBridgeAccount.update({
      where: { id: accountId },
      data: { status: "error", lastError: msg },
    });
    return { ok: false, error: msg };
  }

  const client = await createYandexDavClient(creds);
  let calendars: DAVCalendar[];
  try {
    calendars = await client.fetchCalendars();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "CalDAV fetchCalendars failed";
    await prisma.calendarBridgeAccount.update({
      where: { id: accountId },
      data: { status: "error", lastError: msg },
    });
    return { ok: false, error: msg };
  }

  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - 3);
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 1);

  const timeRange = {
    start: start.toISOString(),
    end: end.toISOString(),
  };

  let eventsUpserted = 0;

  for (const sub of account.subscriptions) {
    const cal = findCalendarByUrl(calendars, sub.resourceHref) as DAVCalendar | undefined;
    if (!cal) {
      await prisma.calendarBridgeSubscription.update({
        where: { id: sub.id },
        data: { ctag: null },
      });
      continue;
    }

    const dn = displayNameFromCalendar(cal);
    await prisma.calendarBridgeSubscription.update({
      where: { id: sub.id },
      data: {
        displayName: dn ?? sub.displayName,
        ctag: cal.ctag ?? sub.ctag,
      },
    });

    let objects;
    try {
      objects = await fetchCalendarObjects({
        calendar: cal,
        timeRange,
        expand: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetchCalendarObjects failed";
      await prisma.calendarBridgeAccount.update({
        where: { id: accountId },
        data: { status: "error", lastError: msg },
      });
      return { ok: false, error: msg };
    }

    const seenHrefs = new Set<string>();

    for (const obj of objects) {
      const href = obj.url;
      const data = typeof obj.data === "string" ? obj.data : String(obj.data ?? "");
      if (!href || !data) continue;

      seenHrefs.add(href);
      const parsed = parseFirstVevent(data);
      if (!parsed) continue;

      await prisma.calendarBridgeEvent.upsert({
        where: {
          subscriptionId_objectHref: {
            subscriptionId: sub.id,
            objectHref: href,
          },
        },
        create: {
          subscriptionId: sub.id,
          objectHref: href,
          etag: obj.etag ?? null,
          uid: parsed.uid,
          recurrenceId: parsed.recurrenceId,
          rawIcs: data,
          summary: parsed.summary,
          location: parsed.location,
          description: parsed.description,
          startAt: parsed.startAt,
          endAt: parsed.endAt,
          allDay: parsed.allDay,
          updatedRemote: new Date(),
        },
        update: {
          etag: obj.etag ?? null,
          uid: parsed.uid,
          recurrenceId: parsed.recurrenceId,
          rawIcs: data,
          summary: parsed.summary,
          location: parsed.location,
          description: parsed.description,
          startAt: parsed.startAt,
          endAt: parsed.endAt,
          allDay: parsed.allDay,
          updatedRemote: new Date(),
        },
      });
      eventsUpserted += 1;
    }

    if (seenHrefs.size === 0) {
      await prisma.calendarBridgeEvent.deleteMany({
        where: { subscriptionId: sub.id },
      });
    } else {
      await prisma.calendarBridgeEvent.deleteMany({
        where: {
          subscriptionId: sub.id,
          objectHref: { notIn: Array.from(seenHrefs) },
        },
      });
    }
  }

  await prisma.calendarBridgeAccount.update({
    where: { id: accountId },
    data: {
      status: "active",
      lastError: null,
      lastSyncedAt: new Date(),
    },
  });

  return { ok: true, eventsUpserted };
}

export async function fetchYandexCalendarsList(accountId: string): Promise<{
  ok: boolean;
  calendars?: Array<{ url: string; displayName: string | null; ctag: string | null }>;
  error?: string;
}> {
  const account = await prisma.calendarBridgeAccount.findFirst({
    where: { id: accountId },
  });
  if (!account) return { ok: false, error: "Account not found" };

  let creds;
  try {
    creds = decryptYandexCredentials(account.encryptedCredentials);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Credentials error" };
  }

  const client = await createYandexDavClient(creds);
  try {
    const calendars = await client.fetchCalendars();
    const list = calendars.map((c) => ({
      url: c.url,
      displayName: typeof c.displayName === "string" ? c.displayName : null,
      ctag: c.ctag ?? null,
    }));
    return { ok: true, calendars: list };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetchCalendars failed",
    };
  }
}
