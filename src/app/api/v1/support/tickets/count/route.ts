import { NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/** GET - количество тикетов с ответом от админа (AWAITING_USER) */
export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request as import("next/server").NextRequest);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.supportTicket.count({
    where: { userId, status: "AWAITING_USER" },
  });
  return NextResponse.json({ awaitingUserCount: count });
}
