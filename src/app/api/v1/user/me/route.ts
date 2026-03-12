import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      lastLoginAt: true,
      createdAt: true,
      preferences: true,
      telegramUserId: true,
      telegramUsername: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const prefs = user.preferences as Record<string, unknown> | null;
  const isPlaceholderEmail = user.email.endsWith("@qoqon.placeholder");
  const hasTelegram = user.telegramUserId != null;
  const canLinkTelegram = !isPlaceholderEmail && !hasTelegram;
  const canLinkEmail = isPlaceholderEmail && hasTelegram;
  const pendingEmailVerification = await prisma.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      purpose: "LINK_EMAIL",
      usedAt: null,
      expiresAt: { gt: new Date() },
      newEmail: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      newEmail: true,
      expiresAt: true,
    },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    preferences: prefs ?? {},
    telegramUserId: user.telegramUserId?.toString() ?? null,
    telegramUsername: user.telegramUsername ?? null,
    accountLinking: {
      canLinkTelegram,
      canLinkEmail,
      hasTelegram,
      isPlaceholderEmail,
      telegramUserId: user.telegramUserId?.toString() ?? null,
      telegramUsername: user.telegramUsername ?? null,
      pendingEmailVerification: pendingEmailVerification
        ? {
            email: pendingEmailVerification.newEmail,
            expiresAt: pendingEmailVerification.expiresAt.toISOString(),
          }
        : null,
    },
  });
}
