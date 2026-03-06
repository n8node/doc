import { prisma } from "./prisma";
import type { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  category: "info" | "warning" | "success" | "error";
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      body: input.body ?? null,
      payload: (input.payload ?? null) as object | null,
    },
  });
}

export interface ListNotificationsInput {
  userId: string;
  limit?: number;
  offset?: number;
  type?: NotificationType;
  unreadOnly?: boolean;
}

export async function listNotifications(input: ListNotificationsInput) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);

  const where = {
    userId: input.userId,
    ...(input.type && { type: input.type }),
    ...(input.unreadOnly && { readAt: null }),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  const unreadCount = await prisma.notification.count({
    where: { userId: input.userId, readAt: null },
  });

  return { items, total, unreadCount };
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function deleteAllNotifications(userId: string) {
  return prisma.notification.deleteMany({
    where: { userId },
  });
}
