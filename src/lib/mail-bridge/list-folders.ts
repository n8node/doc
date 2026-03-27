import { ImapFlow } from "imapflow";
import { decryptYandexCredentials } from "@/lib/calendar-bridge/credentials";
import { YANDEX_IMAP_HOST, YANDEX_IMAP_PORT } from "./constants";

export type MailFolderListItem = {
  path: string;
  name: string;
  specialUse?: string;
};

export async function listYandexMailFolders(encryptedCredentials: string): Promise<
  { ok: true; folders: MailFolderListItem[] } | { ok: false; error: string }
> {
  let creds;
  try {
    creds = decryptYandexCredentials(encryptedCredentials);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Credentials error" };
  }

  const client = new ImapFlow({
    host: YANDEX_IMAP_HOST,
    port: YANDEX_IMAP_PORT,
    secure: true,
    auth: { user: creds.login, pass: creds.password },
    logger: false,
  });

  try {
    await client.connect();
    const list = await client.list();
    await client.logout();

    const folders: MailFolderListItem[] = list
      .filter((e) => !e.flags.has("\\Noselect"))
      .map((e) => ({
        path: e.path,
        name: e.name || e.path,
        specialUse: e.specialUse,
      }))
      .sort((a, b) => a.path.localeCompare(b.path, "ru"));

    return { ok: true, folders };
  } catch (e) {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, error: e instanceof Error ? e.message : "LIST failed" };
  }
}
