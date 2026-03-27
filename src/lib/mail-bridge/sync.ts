import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";
import { prisma } from "@/lib/prisma";
import { decryptYandexCredentials } from "@/lib/calendar-bridge/credentials";
import {
  BODY_TEXT_MAX_LEN,
  DEFAULT_FOLDER,
  SYNC_MAX_MESSAGES_PER_RUN,
  YANDEX_IMAP_HOST,
  YANDEX_IMAP_PORT,
} from "./constants";

function uidValidityFromMailbox(mailbox: { uidValidity?: bigint } | null | undefined): string {
  const v = mailbox?.uidValidity;
  if (v === undefined || v === null) return "0";
  return typeof v === "bigint" ? v.toString() : String(v);
}

function formatMailparserAddresses(field: AddressObject | AddressObject[] | undefined): string | null {
  if (!field) return null;
  const objs = Array.isArray(field) ? field : [field];
  const out: string[] = [];
  for (const o of objs) {
    for (const v of o.value ?? []) {
      if (v.address) out.push(v.address);
      else if (v.name) out.push(v.name);
    }
  }
  return out.length ? out.join(", ") : null;
}

export async function syncMailBridgeAccount(accountId: string): Promise<{
  ok: boolean;
  error?: string;
  messagesUpserted?: number;
}> {
  const account = await prisma.mailBridgeAccount.findFirst({
    where: { id: accountId },
  });
  if (!account) return { ok: false, error: "Account not found" };

  let creds;
  try {
    creds = decryptYandexCredentials(account.encryptedCredentials);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Credentials error";
    await prisma.mailBridgeAccount.update({
      where: { id: accountId },
      data: { status: "error", lastError: msg },
    });
    return { ok: false, error: msg };
  }

  const client = new ImapFlow({
    host: YANDEX_IMAP_HOST,
    port: YANDEX_IMAP_PORT,
    secure: true,
    auth: { user: creds.login, pass: creds.password },
    logger: false,
  });

  let messagesUpserted = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(DEFAULT_FOLDER);
    try {
      const mbox = client.mailbox;
      if (!mbox) {
        throw new Error("INBOX not available");
      }
      const uidValidity = uidValidityFromMailbox(mbox);

      const state = await prisma.mailBridgeFolderState.findUnique({
        where: {
          accountId_folderPath: { accountId, folderPath: DEFAULT_FOLDER },
        },
      });

      if (state && state.uidValidity !== uidValidity) {
        await prisma.mailBridgeMessage.deleteMany({
          where: { accountId, folderPath: DEFAULT_FOLDER },
        });
      }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Math.max(1, account.syncDaysBack));

      const searchResult = await client.search({ since: cutoff }, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const toProcess = uids.slice(0, SYNC_MAX_MESSAGES_PER_RUN);

      for (const uid of toProcess) {
        const existing = await prisma.mailBridgeMessage.findFirst({
          where: {
            accountId,
            folderPath: DEFAULT_FOLDER,
            imapUid: uid,
            uidValidity,
          },
        });
        if (existing) continue;

        const fetched = await client.fetchOne(uid, { envelope: true, source: true, internalDate: true, flags: true }, { uid: true });
        if (!fetched || !fetched.source) continue;

        let parsed;
        try {
          parsed = await simpleParser(fetched.source);
        } catch {
          continue;
        }

        const fromAddr =
          formatMailparserAddresses(parsed.from) || fetched.envelope?.from?.[0]?.address || null;
        const toAddr =
          formatMailparserAddresses(parsed.to) ||
          fetched.envelope?.to?.map((a) => a.address).filter(Boolean).join(", ") ||
          null;

        let bodyText = parsed.text || "";
        if (bodyText.length > BODY_TEXT_MAX_LEN) {
          bodyText = bodyText.slice(0, BODY_TEXT_MAX_LEN);
        }

        const internalDate =
          fetched.internalDate instanceof Date
            ? fetched.internalDate
            : parsed.date
              ? new Date(parsed.date)
              : new Date();

        const seen = fetched.flags?.has("\\Seen") ?? false;

        await prisma.mailBridgeMessage.create({
          data: {
            accountId,
            folderPath: DEFAULT_FOLDER,
            imapUid: uid,
            uidValidity,
            messageIdHeader: parsed.messageId ?? null,
            subject: parsed.subject ?? fetched.envelope?.subject ?? null,
            fromAddress: fromAddr,
            toAddress: toAddr,
            date: internalDate,
            snippet: (parsed.text || parsed.html || "").replace(/\s+/g, " ").trim().slice(0, 2000) || null,
            bodyText: bodyText || null,
            seen,
          },
        });
        messagesUpserted += 1;
      }

      const highestUid = toProcess.length > 0 ? Math.max(...toProcess) : state?.highestUid ?? 0;

      await prisma.mailBridgeFolderState.upsert({
        where: {
          accountId_folderPath: { accountId, folderPath: DEFAULT_FOLDER },
        },
        create: {
          accountId,
          folderPath: DEFAULT_FOLDER,
          uidValidity,
          highestUid,
        },
        update: {
          uidValidity,
          highestUid: Math.max(highestUid, state?.highestUid ?? 0),
        },
      });
    } finally {
      lock.release();
    }

    await client.logout();

    await prisma.mailBridgeAccount.update({
      where: { id: accountId },
      data: {
        status: "active",
        lastError: null,
        lastSyncedAt: new Date(),
      },
    });

    return { ok: true, messagesUpserted };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "IMAP sync failed";
    await prisma.mailBridgeAccount.update({
      where: { id: accountId },
      data: { status: "error", lastError: msg },
    });
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }
}
