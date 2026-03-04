import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const THEMES = ["light", "dark", "system"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  const prefs = (user?.preferences as Record<string, unknown>) ?? {};
  return NextResponse.json({
    theme: typeof prefs.theme === "string" && THEMES.includes(prefs.theme as (typeof THEMES)[number])
      ? prefs.theme
      : "system",
    emailNotifications: typeof prefs.emailNotifications === "boolean" ? prefs.emailNotifications : true,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.theme !== undefined) {
    const theme = typeof body.theme === "string" ? body.theme : "system";
    updates.theme = THEMES.includes(theme as (typeof THEMES)[number]) ? theme : "system";
  }
  if (body.emailNotifications !== undefined) {
    updates.emailNotifications = Boolean(body.emailNotifications);
  }

  if (Object.keys(updates).length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    const prefs = (user?.preferences as Record<string, unknown>) ?? {};
    return NextResponse.json({
      theme: prefs.theme ?? "system",
      emailNotifications: prefs.emailNotifications !== false,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  });

  const current = (user?.preferences as Record<string, unknown>) ?? {};
  const nextPrefs = { ...current, ...updates };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { preferences: nextPrefs as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    theme: nextPrefs.theme ?? "system",
    emailNotifications: nextPrefs.emailNotifications !== false,
  });
}
