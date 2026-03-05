import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApiKey } from "@/lib/api-key-auth";

/**
 * GET /api/user/api-keys — list API keys (session only)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.userApiKey.findMany({
    where: { userId: session.user.id },
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
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/user/api-keys — create API key (session only)
 * Body: { name: string }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  try {
    const result = await createApiKey(session.user.id, name || "API Key");
    return NextResponse.json({
      id: result.id,
      name: result.name,
      key: result.key,
      keyPrefix: result.keyPrefix,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[api-keys] create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка создания ключа" },
      { status: 500 }
    );
  }
}
