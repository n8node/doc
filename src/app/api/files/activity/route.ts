import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/rtf",
];

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseMonth(monthRaw: string | null) {
  if (!monthRaw || !/^\d{4}-\d{2}$/.test(monthRaw)) return null;
  const [yearRaw, monthIndexRaw] = monthRaw.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthIndexRaw) - 1;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }
  return { year, monthIndex };
}

function parseBigIntParam(value: string | null) {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId");
  const scope = searchParams.get("scope");
  const typeFilter = searchParams.get("type");
  const sizeMin = searchParams.get("sizeMin");
  const sizeMax = searchParams.get("sizeMax");
  const hasShareLink = searchParams.get("hasShareLink");
  const monthRaw = searchParams.get("month");
  const tzOffsetRaw = searchParams.get("tzOffsetMinutes");

  const parsedMonth = parseMonth(monthRaw);
  if (!parsedMonth) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const parsedSizeMin = parseBigIntParam(sizeMin);
  const parsedSizeMax = parseBigIntParam(sizeMax);
  if ((sizeMin && parsedSizeMin === null) || (sizeMax && parsedSizeMax === null)) {
    return NextResponse.json({ error: "sizeMin/sizeMax must be positive integers" }, { status: 400 });
  }

  const parsedOffset = Number(tzOffsetRaw);
  const tzOffsetMinutes =
    Number.isFinite(parsedOffset) && Math.abs(parsedOffset) <= 14 * 60
      ? Math.trunc(parsedOffset)
      : 0;

  const rangeStartUtc = new Date(
    Date.UTC(parsedMonth.year, parsedMonth.monthIndex, 1, 0, 0, 0, 0) +
      tzOffsetMinutes * 60 * 1000
  );
  const rangeEndUtc = new Date(
    Date.UTC(parsedMonth.year, parsedMonth.monthIndex + 1, 1, 0, 0, 0, 0) +
      tzOffsetMinutes * 60 * 1000
  );

  const where: {
    userId: string;
    folderId?: string | null;
    createdAt: { gte: Date; lt: Date };
    mimeType?: { startsWith: string } | { in: string[] };
    size?: { gte?: bigint; lte?: bigint };
    shareLinks?: { some: { OR: Array<{ expiresAt: null } | { expiresAt: { gt: Date } }> } };
  } = {
    userId: session.user.id,
    createdAt: {
      gte: rangeStartUtc,
      lt: rangeEndUtc,
    },
  };

  if (scope !== "all") {
    where.folderId = folderId || null;
  }

  if (typeFilter && typeFilter !== "all") {
    if (typeFilter === "image") where.mimeType = { startsWith: "image/" };
    else if (typeFilter === "video") where.mimeType = { startsWith: "video/" };
    else if (typeFilter === "audio") where.mimeType = { startsWith: "audio/" };
    else if (typeFilter === "document") where.mimeType = { in: DOCUMENT_MIMES };
  }

  if (sizeMin || sizeMax) {
    where.size = {};
    if (parsedSizeMin !== null) where.size.gte = parsedSizeMin;
    if (parsedSizeMax !== null) where.size.lte = parsedSizeMax;
  }

  if (hasShareLink === "true") {
    where.shareLinks = {
      some: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    };
  }

  const files = await prisma.file.findMany({
    where,
    select: {
      createdAt: true,
    },
  });

  const countsByDay: Record<string, number> = {};
  for (const file of files) {
    const shifted = new Date(file.createdAt.getTime() - tzOffsetMinutes * 60 * 1000);
    const dateKey = `${shifted.getUTCFullYear()}-${pad2(
      shifted.getUTCMonth() + 1
    )}-${pad2(shifted.getUTCDate())}`;
    countsByDay[dateKey] = (countsByDay[dateKey] ?? 0) + 1;
  }

  const days = Object.entries(countsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({ days });
}
