import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeUserId } from "@/lib/mail-bridge-api-auth";
import { sendViaYandexSmtp } from "@/lib/mail-bridge/send-mail";

export async function POST(req: NextRequest) {
  const userId = await getMailBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    accountId?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.text === "string" ? body.text : undefined;
  const html = typeof body.html === "string" ? body.html : undefined;

  if (!accountId || !to || !subject) {
    return NextResponse.json(
      { error: "Нужны accountId, to, subject; опционально text или html" },
      { status: 400 }
    );
  }
  if (!text && !html) {
    return NextResponse.json({ error: "Укажите text или html" }, { status: 400 });
  }

  const account = await prisma.mailBridgeAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const result = await sendViaYandexSmtp({
    encryptedCredentials: account.encryptedCredentials,
    to,
    subject,
    text,
    html,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
