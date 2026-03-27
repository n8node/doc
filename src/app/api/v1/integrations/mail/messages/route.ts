import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailBridgeUserId } from "@/lib/mail-bridge-api-auth";
import { mailMessageListItem } from "@/lib/mail-bridge/api-json";
import { DEFAULT_FOLDER } from "@/lib/mail-bridge/constants";

export async function GET(req: NextRequest) {
  const userId = await getMailBridgeUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId")?.trim() ?? "";
  if (!accountId) {
    return NextResponse.json({ error: "Query accountId is required" }, { status: 400 });
  }

  const account = await prisma.mailBridgeAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const folder = searchParams.get("folder")?.trim() || DEFAULT_FOLDER;
  const fromQ = searchParams.get("from");
  const toQ = searchParams.get("to");
  const fromDate = fromQ ? new Date(fromQ) : null;
  const toDate = toQ ? new Date(toQ) : null;
  if (fromQ && Number.isNaN(fromDate?.getTime())) {
    return NextResponse.json({ error: "Invalid from" }, { status: 400 });
  }
  if (toQ && Number.isNaN(toDate?.getTime())) {
    return NextResponse.json({ error: "Invalid to" }, { status: 400 });
  }

  let limit = Number(searchParams.get("limit") ?? "50");
  if (!Number.isFinite(limit)) limit = 50;
  limit = Math.min(200, Math.max(1, Math.floor(limit)));

  const where: Prisma.MailBridgeMessageWhereInput = {
    accountId,
    folderPath: folder,
  };
  if (fromDate && toDate) {
    where.date = { gte: fromDate, lte: toDate };
  } else if (fromDate) {
    where.date = { gte: fromDate };
  } else if (toDate) {
    where.date = { lte: toDate };
  }

  const rows = await prisma.mailBridgeMessage.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
  });

  return NextResponse.json({
    messages: rows.map(mailMessageListItem),
  });
}
