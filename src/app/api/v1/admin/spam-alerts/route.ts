import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10))
  );
  const severity = (req.nextUrl.searchParams.get("severity") || "").toUpperCase();
  const sentToTelegram = req.nextUrl.searchParams.get("sentToTelegram");
  const search = (req.nextUrl.searchParams.get("search") || "").trim();

  const where: {
    severity?: "WARNING" | "CRITICAL";
    sentToTelegram?: boolean;
    OR?: Array<{
      rootUser?: {
        email?: { contains: string; mode: "insensitive" };
        name?: { contains: string; mode: "insensitive" };
      };
    }>;
  } = {};

  if (severity === "WARNING" || severity === "CRITICAL") {
    where.severity = severity;
  }
  if (sentToTelegram === "true") where.sentToTelegram = true;
  if (sentToTelegram === "false") where.sentToTelegram = false;
  if (search) {
    where.OR = [
      { rootUser: { email: { contains: search, mode: "insensitive" } } },
      { rootUser: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.spamAlertEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        severity: true,
        score: true,
        registrationsCount: true,
        verificationRate: true,
        activityRate: true,
        uniqueDomains: true,
        windowStart: true,
        windowEnd: true,
        sentToTelegram: true,
        details: true,
        createdAt: true,
        rootUser: {
          select: {
            id: true,
            email: true,
            name: true,
            isBlocked: true,
          },
        },
      },
    }),
    prisma.spamAlertEvent.count({ where }),
  ]);

  return NextResponse.json({
    items: events.map((item) => {
      const details = (item.details ?? null) as {
        reasons?: string[];
        domains?: string[];
      } | null;
      return {
        id: item.id,
        severity: item.severity,
        score: item.score,
        registrationsCount: item.registrationsCount,
        verificationRate: item.verificationRate,
        activityRate: item.activityRate,
        uniqueDomains: item.uniqueDomains,
        windowStart: item.windowStart,
        windowEnd: item.windowEnd,
        sentToTelegram: item.sentToTelegram,
        createdAt: item.createdAt,
        reasons: details?.reasons ?? [],
        domains: details?.domains ?? [],
        rootUser: item.rootUser,
      };
    }),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
