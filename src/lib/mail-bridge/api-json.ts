import type { MailBridgeMessage } from "@prisma/client";

export function mailMessageListItem(row: MailBridgeMessage) {
  return {
    id: row.id,
    accountId: row.accountId,
    folder: row.folderPath,
    subject: row.subject,
    from: row.fromAddress,
    to: row.toAddress,
    date: row.date.toISOString(),
    snippet: row.snippet,
    seen: row.seen,
  };
}

export function mailMessageDetail(row: MailBridgeMessage) {
  return {
    ...mailMessageListItem(row),
    bodyText: row.bodyText,
    messageId: row.messageIdHeader,
  };
}
