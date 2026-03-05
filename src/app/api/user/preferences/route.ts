import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const THEMES = ["light", "dark", "system"] as const;

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
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
      where: { id: userId },
      select: { preferences: true },
    });
    const prefs = (user?.preferences as Record<string, unknown>) ?? {};
    return NextResponse.json({
      theme: prefs.theme ?? "system",
      emailNotifications: prefs.emailNotifications !== false,
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const current = (user?.preferences as Record<string, unknown>) ?? {};
  const nextPrefs = { ...current, ...updates };

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: nextPrefs as Prisma.InputJsonValue },
  });

  return NextResponse.json({
    theme: nextPrefs.theme ?? "system",
    emailNotifications: nextPrefs.emailNotifications !== false,
  });
}
