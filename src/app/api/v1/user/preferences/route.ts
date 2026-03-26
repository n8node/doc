import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const THEMES = ["light", "dark", "system"] as const;

const NOTIFICATION_KEYS = [
  "storage",
  "trash",
  "payment",
  "aiTask",
  "quota",
  "shareLink",
  "shareGrant",
] as const;

const MODULE_KEYS = [
  "storage",
  "ai_tools",
  "generation",
  "integrations",
  "tools",
] as const;

type ModulePrefs = Record<(typeof MODULE_KEYS)[number], boolean>;

function parseModulePrefs(obj: unknown): ModulePrefs {
  const def: ModulePrefs = {
    storage: true,
    ai_tools: true,
    generation: true,
    integrations: true,
    tools: true,
  };
  if (!obj || typeof obj !== "object") return def;
  const o = obj as Record<string, unknown>;
  for (const k of MODULE_KEYS) {
    if (typeof o[k] === "boolean") def[k] = o[k] as boolean;
  }
  def.storage = true;
  return def;
}

type NotificationPrefs = Record<(typeof NOTIFICATION_KEYS)[number], boolean>;

function parseNotificationPrefs(obj: unknown): NotificationPrefs {
  const def: NotificationPrefs = {
    storage: true,
    trash: true,
    payment: true,
    aiTask: true,
    quota: true,
    shareLink: true,
    shareGrant: true,
  };
  if (!obj || typeof obj !== "object") return def;
  const o = obj as Record<string, unknown>;
  for (const k of NOTIFICATION_KEYS) {
    if (typeof o[k] === "boolean") def[k] = o[k] as boolean;
  }
  return def;
}

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
    notifications: parseNotificationPrefs(prefs.notifications),
    embeddingConfig: prefs.embeddingConfig && typeof prefs.embeddingConfig === "object" ? prefs.embeddingConfig : null,
    modules: parseModulePrefs(prefs.modules),
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
  if (body.notifications !== undefined && typeof body.notifications === "object") {
    const n = body.notifications as Record<string, unknown>;
    const prev = (await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }))?.preferences as Record<string, unknown> | null;
    const prevN = parseNotificationPrefs(prev?.notifications);
    for (const k of NOTIFICATION_KEYS) {
      if (typeof n[k] === "boolean") prevN[k] = n[k] as boolean;
    }
    updates.notifications = prevN;
  }

  if (body.modules !== undefined && typeof body.modules === "object") {
    const m = body.modules as Record<string, unknown>;
    const prev = (await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }))?.preferences as Record<string, unknown> | null;
    const prevM = parseModulePrefs(prev?.modules);
    for (const k of MODULE_KEYS) {
      if (typeof m[k] === "boolean") prevM[k] = m[k] as boolean;
    }
    prevM.storage = true;
    updates.modules = prevM;
  }

  if (body.embeddingConfig !== undefined) {
    const ec = body.embeddingConfig as Record<string, unknown> | null;
    if (ec === null) {
      updates.embeddingConfig = null;
    } else if (typeof ec === "object" && ec !== null) {
      const valid: Record<string, unknown> = {};
      if (typeof ec.chunkSize === "number") valid.chunkSize = Math.min(2000, Math.max(100, ec.chunkSize));
      if (typeof ec.chunkOverlap === "number") valid.chunkOverlap = Math.min(200, Math.max(0, ec.chunkOverlap));
      if (ec.chunkStrategy === "paragraphs" || ec.chunkStrategy === "sentences" || ec.chunkStrategy === "fixed") {
        valid.chunkStrategy = ec.chunkStrategy;
      }
      if (ec.dimensions === null) valid.dimensions = null;
      else if (typeof ec.dimensions === "number") valid.dimensions = Math.min(3072, Math.max(256, ec.dimensions));
      if (typeof ec.similarityThreshold === "number") {
        valid.similarityThreshold = Math.min(0.95, Math.max(0.3, ec.similarityThreshold));
      }
      if (typeof ec.topK === "number") valid.topK = Math.min(50, Math.max(1, ec.topK));
      updates.embeddingConfig = Object.keys(valid).length > 0 ? valid : null;
    }
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
      notifications: parseNotificationPrefs(prefs.notifications),
      embeddingConfig: prefs.embeddingConfig && typeof prefs.embeddingConfig === "object" ? prefs.embeddingConfig : null,
      modules: parseModulePrefs(prefs.modules),
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
    notifications: parseNotificationPrefs(nextPrefs.notifications),
    embeddingConfig:
      nextPrefs.embeddingConfig && typeof nextPrefs.embeddingConfig === "object" ? nextPrefs.embeddingConfig : null,
    modules: parseModulePrefs(nextPrefs.modules),
  });
}
