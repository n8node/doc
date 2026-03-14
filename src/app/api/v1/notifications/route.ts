import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import {
  listNotifications,
  deleteAllNotifications,
} from "@/lib/notification-service";
import type { NotificationType } from "@prisma/client";

const VALID_TYPES: NotificationType[] = [
  "STORAGE",
  "TRASH",
  "PAYMENT",
  "AI_TASK",
  "QUOTA",
  "SHARE_LINK",
  "SUPPORT_TICKET",
];

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1),
    200
  );
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
  const typeParam = searchParams.get("type");
  const type =
    typeParam && VALID_TYPES.includes(typeParam as NotificationType)
      ? (typeParam as NotificationType)
      : undefined;
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const result = await listNotifications({
    userId,
    limit,
    offset,
    type,
    unreadOnly,
  });

  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteAllNotifications(userId);
  return NextResponse.json({ deleted: result.count });
}
