import { createDAVClient } from "tsdav";
import type { DAVCalendar } from "tsdav";
import { YANDEX_CALDAV_SERVER_URL } from "./constants";
import type { YandexCalendarCredentials } from "./credentials";

export async function createYandexDavClient(creds: YandexCalendarCredentials) {
  return createDAVClient({
    serverUrl: YANDEX_CALDAV_SERVER_URL,
    credentials: {
      username: creds.login,
      password: creds.password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

export function normalizeCalendarUrl(url: string): string {
  try {
    const u = new URL(url, YANDEX_CALDAV_SERVER_URL);
    return u.href.replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

export function findCalendarByUrl(
  calendars: DAVCalendar[],
  resourceHref: string
): DAVCalendar | undefined {
  const want = normalizeCalendarUrl(resourceHref);
  return calendars.find((c) => normalizeCalendarUrl(c.url) === want);
}
