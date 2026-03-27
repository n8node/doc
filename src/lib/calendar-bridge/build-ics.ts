import ICAL from "ical.js";
import { nanoid } from "nanoid";

export type BuildEventParams = {
  uid: string;
  summary: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  /** при обновлении — увеличить, если было в исходном ICS */
  sequence?: number;
};

function toUtcTime(date: Date, allDay: boolean): InstanceType<typeof ICAL.Time> {
  if (allDay) {
    return ICAL.Time.fromData(
      {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        isDate: true,
      },
      ICAL.Timezone.utcTimezone
    );
  }
  return ICAL.Time.fromJSDate(date, true);
}

/**
 * Полный текст VCALENDAR с одним VEVENT (для PUT/создания на CalDAV).
 */
export function buildVcalendarWithEvent(params: BuildEventParams): string {
  const cal = new ICAL.Component(["vcalendar", [], []]);
  cal.updatePropertyWithValue("version", "2.0");
  cal.updatePropertyWithValue("prodid", "-//QoQon//Calendar Bridge//EN");
  cal.updatePropertyWithValue("calscale", "GREGORIAN");

  const vevent = new ICAL.Component("vevent");
  const ev = new ICAL.Event(vevent);

  ev.uid = params.uid;
  ev.summary = params.summary;
  if (params.location) ev.location = params.location;
  if (params.description) ev.description = params.description;

  const start = toUtcTime(params.startAt, params.allDay);
  let end = toUtcTime(params.endAt, params.allDay);
  if (params.allDay) {
    const s = params.startAt.getTime();
    const e = params.endAt.getTime();
    if (e <= s) {
      const next = new Date(params.startAt);
      next.setUTCDate(next.getUTCDate() + 1);
      end = toUtcTime(next, true);
    }
  }

  ev.startDate = start;
  ev.endDate = end;

  const stamp = ICAL.Time.fromJSDate(new Date(), true);
  vevent.updatePropertyWithValue("dtstamp", stamp);

  if (typeof params.sequence === "number" && params.sequence >= 0) {
    ev.sequence = params.sequence;
  }

  cal.addSubcomponent(vevent);
  return cal.toString();
}

export function newEventUid(): string {
  return `${nanoid(20)}@qoqon.calendar`;
}

export function safeCalendarFilename(uid: string): string {
  const base = uid.split("@")[0] ?? nanoid(12);
  return `${base.replace(/[^a-zA-Z0-9._-]/g, "_")}.ics`;
}
