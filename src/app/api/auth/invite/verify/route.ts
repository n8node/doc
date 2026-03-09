import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInviteRegistrationEnabled, isInviteCodeFormatValid, normalizeInviteCode } from "@/lib/invite";

export async function POST(req: NextRequest) {
  try {
    const enabled = await isInviteRegistrationEnabled();
    if (!enabled) {
      return NextResponse.json({ ok: true, inviteRequired: false });
    }

    const body = await req.json().catch(() => ({}));
    const normalized = normalizeInviteCode(String(body.inviteCode ?? ""));

    if (!isInviteCodeFormatValid(normalized)) {
      return NextResponse.json({ error: "Некорректный формат инвайт-ключа" }, { status: 400 });
    }

    const now = new Date();
    const invite = await prisma.invite.findFirst({
      where: {
        code: normalized,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });

    if (!invite) {
      return NextResponse.json({ error: "Инвайт-ключ недействителен или уже использован" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      inviteRequired: true,
      inviteCode: normalized,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка проверки инвайта" }, { status: 500 });
  }
}
