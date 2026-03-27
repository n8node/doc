import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createMailBridgeApiKey } from "@/lib/mail-bridge-api-auth";
import { getMailBridgeSessionUserId } from "@/lib/mail-bridge/session";

export async function GET() {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const keys = await prisma.mailBridgeApiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    keys: keys.map((k) => ({
      ...k,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getMailBridgeSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = typeof body.name === "string" ? body.name : "n8n";
  const created = await createMailBridgeApiKey(userId, name);

  return NextResponse.json({
    id: created.id,
    name: created.name,
    key: created.key,
    keyPrefix: created.keyPrefix,
  });
}
