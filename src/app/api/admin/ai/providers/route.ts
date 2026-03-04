import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, maskApiKey, decryptApiKey } from "@/lib/ai/encrypt";

const KNOWN_PROVIDERS = ["openai", "yandex", "gigachat", "openrouter"] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const providers = await prisma.aiProvider.findMany({
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      modelName: p.modelName,
      apiKeyMasked: p.apiKey ? maskApiKey(decryptApiKey(p.apiKey)) : null,
      hasApiKey: !!p.apiKey,
      folderId: p.folderId,
      isActive: p.isActive,
      config: p.config,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    knownProviders: KNOWN_PROVIDERS,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, type, baseUrl, modelName, apiKey, folderId, config } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name обязателен" }, { status: 400 });
  }
  if (!type || !["CLOUD", "SELF_HOSTED", "LOCAL"].includes(type)) {
    return NextResponse.json({ error: "type должен быть CLOUD, SELF_HOSTED или LOCAL" }, { status: 400 });
  }

  const existing = await prisma.aiProvider.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: `Провайдер "${name}" уже существует` }, { status: 409 });
  }

  const provider = await prisma.aiProvider.create({
    data: {
      name,
      type,
      baseUrl: baseUrl || null,
      modelName: modelName || null,
      apiKey: apiKey ? encryptApiKey(apiKey) : null,
      folderId: folderId || null,
      isActive: false,
      config: config || null,
    },
  });

  return NextResponse.json({
    id: provider.id,
    name: provider.name,
    type: provider.type,
    isActive: provider.isActive,
  }, { status: 201 });
}
