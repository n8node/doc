import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/ai/encrypt";
import { AiProviderFactory } from "@/lib/ai/factory";
import type { AiProviderConfig } from "@/lib/ai/types";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  try { requireAdmin(session); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await prisma.aiProvider.findUnique({
    where: { id: params.id },
  });
  if (!row) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  if (!row.apiKey) {
    return NextResponse.json(
      { ok: false, error: "API-ключ не задан" },
      { status: 400 },
    );
  }

  const config: AiProviderConfig = {
    type: row.type as AiProviderConfig["type"],
    baseUrl: row.baseUrl ?? undefined,
    apiKey: decryptApiKey(row.apiKey),
    modelName: row.modelName ?? "text-embedding-3-small",
    folderId: row.folderId ?? undefined,
  };

  const provider = AiProviderFactory.create(row.name, config);
  const start = Date.now();

  try {
    const result = await provider.generateEmbedding("Тестовый запрос для проверки соединения");
    const elapsed = Date.now() - start;

    return NextResponse.json({
      ok: true,
      dimensions: result.dimensions,
      model: result.model,
      latencyMs: elapsed,
    });
  } catch (error) {
    const elapsed = Date.now() - start;
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: elapsed,
    });
  }
}
