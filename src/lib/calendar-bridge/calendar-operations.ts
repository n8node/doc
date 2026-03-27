import {
  createCalendarObject,
  deleteCalendarObject,
  updateCalendarObject,
} from "tsdav";
import type { DAVCalendar } from "tsdav";
import { prisma } from "@/lib/prisma";
import { decryptYandexCredentials } from "./credentials";
import { buildVcalendarWithEvent, newEventUid, safeCalendarFilename } from "./build-ics";
import { createYandexDavClient, findCalendarByUrl } from "./dav-client";
import { parseFirstVevent } from "./parse-ics";
import { syncCalendarBridgeAccount } from "./sync";

function nextSequenceFromRawIcs(raw: string): number {
  const m = /^SEQUENCE:(\d+)/im.exec(raw);
  if (m) return Number.parseInt(m[1], 10) + 1;
  return 1;
}

async function getDavCalendarForSubscription(
  userId: string,
  subscriptionId: string
): Promise<{
  accountId: string;
  davCalendar: DAVCalendar;
  subscription: { id: string; resourceHref: string };
} | null> {
  const sub = await prisma.calendarBridgeSubscription.findFirst({
    where: {
      id: subscriptionId,
      enabled: true,
      account: { userId, provider: "YANDEX" },
    },
    include: { account: true },
  });
  if (!sub) return null;

  const creds = decryptYandexCredentials(sub.account.encryptedCredentials);
  const client = await createYandexDavClient(creds);
  const calendars = await client.fetchCalendars();
  const davCalendar = findCalendarByUrl(calendars, sub.resourceHref) as DAVCalendar | undefined;
  if (!davCalendar) return null;

  return {
    accountId: sub.accountId,
    davCalendar,
    subscription: { id: sub.id, resourceHref: sub.resourceHref },
  };
}

export type CreateCalendarEventInput = {
  userId: string;
  subscriptionId: string;
  summary: string;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
};

export async function createCalendarEventRemote(
  input: CreateCalendarEventInput
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const ctx = await getDavCalendarForSubscription(input.userId, input.subscriptionId);
  if (!ctx) return { ok: false, error: "Календарь не найден или недоступен" };

  const uid = newEventUid();
  const allDay = input.allDay === true;
  const ics = buildVcalendarWithEvent({
    uid,
    summary: input.summary.trim() || "(без названия)",
    startAt: input.startAt,
    endAt: input.endAt,
    allDay,
    location: input.location,
    description: input.description,
  });

  const filename = safeCalendarFilename(uid);
  let res: Response;
  try {
    res = await createCalendarObject({
      calendar: ctx.davCalendar,
      iCalString: ics,
      filename,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CalDAV create failed" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Яндекс CalDAV: ${res.status} ${text.slice(0, 200)}`,
    };
  }

  await syncCalendarBridgeAccount(ctx.accountId);

  const row = await prisma.calendarBridgeEvent.findFirst({
    where: {
      uid,
      subscriptionId: ctx.subscription.id,
    },
    select: { id: true },
  });

  if (!row) {
    return {
      ok: false,
      error: "Событие создано на сервере, но не найдено после синхронизации. Запустите синк вручную.",
    };
  }

  return { ok: true, eventId: row.id };
}

export type PatchCalendarEventInput = {
  userId: string;
  eventId: string;
  summary?: string;
  startAt?: Date;
  endAt?: Date;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
};

export async function updateCalendarEventRemote(
  input: PatchCalendarEventInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.calendarBridgeEvent.findFirst({
    where: {
      id: input.eventId,
      subscription: { account: { userId: input.userId } },
    },
    include: {
      subscription: { include: { account: true } },
    },
  });
  if (!existing) return { ok: false, error: "Событие не найдено" };

  const ctx = await getDavCalendarForSubscription(
    input.userId,
    existing.subscriptionId
  );
  if (!ctx) return { ok: false, error: "Календарь недоступен" };

  const parsed = parseFirstVevent(existing.rawIcs);
  const summary = input.summary ?? existing.summary ?? parsed?.summary ?? "(без названия)";
  const startAt = input.startAt ?? existing.startAt ?? parsed?.startAt ?? new Date();
  const endAt = input.endAt ?? existing.endAt ?? parsed?.endAt ?? new Date(startAt.getTime() + 3600000);
  const allDay = input.allDay ?? existing.allDay ?? parsed?.allDay ?? false;
  const location = input.location !== undefined ? input.location : existing.location ?? parsed?.location;
  const description =
    input.description !== undefined ? input.description : existing.description ?? parsed?.description;

  const seq = nextSequenceFromRawIcs(existing.rawIcs);

  const ics = buildVcalendarWithEvent({
    uid: existing.uid,
    summary: summary.trim() || "(без названия)",
    startAt,
    endAt,
    allDay,
    location: location ?? undefined,
    description: description ?? undefined,
    sequence: seq,
  });

  try {
    const res = await updateCalendarObject({
      calendarObject: {
        url: existing.objectHref,
        etag: existing.etag ?? undefined,
        data: ics,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Яндекс CalDAV: ${res.status} ${text.slice(0, 200)}`,
      };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CalDAV update failed" };
  }

  await syncCalendarBridgeAccount(ctx.accountId);
  return { ok: true };
}

export async function deleteCalendarEventRemote(
  userId: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.calendarBridgeEvent.findFirst({
    where: {
      id: eventId,
      subscription: { account: { userId } },
    },
    include: { subscription: { include: { account: true } } },
  });
  if (!existing) return { ok: false, error: "Событие не найдено" };

  const ctx = await getDavCalendarForSubscription(userId, existing.subscriptionId);
  if (!ctx) return { ok: false, error: "Календарь недоступен" };

  try {
    const res = await deleteCalendarObject({
      calendarObject: {
        url: existing.objectHref,
        etag: existing.etag ?? undefined,
        data: existing.rawIcs,
      },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Яндекс CalDAV: ${res.status} ${text.slice(0, 200)}`,
      };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "CalDAV delete failed" };
  }

  await prisma.calendarBridgeEvent.deleteMany({ where: { id: eventId } });
  await syncCalendarBridgeAccount(ctx.accountId);
  return { ok: true };
}
