import ICAL from "ical.js";

export type ParsedCalendarEvent = {
  uid: string;
  recurrenceId: string | null;
  summary: string | null;
  location: string | null;
  description: string | null;
  startAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
};

function icalTimeToDate(t: InstanceType<typeof ICAL.Time>): Date | null {
  if (!t) return null;
  try {
    return t.toJSDate();
  } catch {
    return null;
  }
}

export function parseFirstVevent(icsData: string): ParsedCalendarEvent | null {
  let jcal: unknown;
  try {
    jcal = ICAL.parse(icsData);
  } catch {
    return null;
  }
  const comp = new ICAL.Component(jcal as never);
  const vevent = comp.getFirstSubcomponent("vevent");
  if (!vevent) return null;

  const ev = new ICAL.Event(vevent);
  const uid = ev.uid;
  if (!uid) return null;

  const rid = vevent.getFirstPropertyValue("recurrence-id");
  let recurrenceId: string | null = null;
  if (rid && typeof (rid as { toString?: () => string }).toString === "function") {
    recurrenceId = String((rid as { toString: () => string }).toString());
  }

  const start = ev.startDate;
  const end = ev.endDate;
  const allDay = !!(start && start.isDate);

  const startAt = start ? icalTimeToDate(start) : null;
  let endAt = end ? icalTimeToDate(end) : null;
  if (allDay && startAt && !endAt) {
    const d = new Date(startAt);
    d.setDate(d.getDate() + 1);
    endAt = d;
  }

  return {
    uid,
    recurrenceId,
    summary: ev.summary ?? null,
    location: ev.location ?? null,
    description: ev.description ?? null,
    startAt,
    endAt,
    allDay,
  };
}
