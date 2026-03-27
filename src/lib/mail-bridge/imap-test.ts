import { ImapFlow } from "imapflow";
import { YANDEX_IMAP_HOST, YANDEX_IMAP_PORT } from "./constants";
import type { YandexCalendarCredentials } from "@/lib/calendar-bridge/credentials";

export async function testYandexImap(creds: YandexCalendarCredentials): Promise<void> {
  const client = new ImapFlow({
    host: YANDEX_IMAP_HOST,
    port: YANDEX_IMAP_PORT,
    secure: true,
    auth: { user: creds.login, pass: creds.password },
    logger: false,
  });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}
