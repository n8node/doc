import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getUserPlan } from "@/lib/plan-service";
import { prisma } from "@/lib/prisma";
import { AiProviderFactory } from "@/lib/ai/factory";
import type { AiProviderConfig } from "@/lib/ai/types";
import { listModelsForProvider } from "@/lib/ai/list-models";

function canUseOwnKeys(features: Record<string, boolean> | undefined): boolean {
  return features?.own_ai_keys === true;
}

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getUserPlan(userId);
  if (!canUseOwnKeys(plan?.features as Record<string, boolean>)) {
    return NextResponse.json(
      { ok: false, error: "Использование собственного API-ключа недоступно на вашем тарифе" },
      { status: 403 },
    );
  }

  let body: {
    providerName: string;
    apiKey?: string;
    baseUrl?: string;
    folderId?: string;
    useStoredKey?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { providerName, apiKey, baseUrl, folderId, useStoredKey } = body;
  if (!providerName) {
    return NextResponse.json({
      ok: false,
      error: "Укажите провайдера",
    }, { status: 400 });
  }

  let apiKeyToUse = apiKey?.trim();
  let baseUrlToUse = baseUrl?.trim();
  let folderIdToUse = folderId?.trim();
  if (!apiKeyToUse && useStoredKey) {
    const existing = await prisma.userAiConfig.findUnique({
      where: { userId },
      select: { apiKey: true, providerName: true, baseUrl: true, folderId: true },
    });
    if (existing?.apiKey && existing.providerName === providerName) {
      const { decryptApiKey } = await import("@/lib/ai/encrypt");
      apiKeyToUse = decryptApiKey(existing.apiKey);
      if (!baseUrlToUse && existing.baseUrl) baseUrlToUse = existing.baseUrl;
      if (!folderIdToUse && existing.folderId) folderIdToUse = existing.folderId;
    }
  }
  if (!apiKeyToUse) {
    return NextResponse.json({
      ok: false,
      error: "Укажите API-ключ или сохраните конфигурацию",
    }, { status: 400 });
  }

  const validProviders = ["openai", "openrouter", "yandex", "gigachat"];
  if (!validProviders.includes(providerName)) {
    return NextResponse.json({ ok: false, error: "Недопустимый провайдер" }, { status: 400 });
  }

  const config: AiProviderConfig = {
    type: "CLOUD",
    baseUrl: baseUrlToUse || undefined,
    apiKey: apiKeyToUse!,
    modelName: providerName === "openai" ? "text-embedding-3-small" : providerName === "openrouter" ? "openai/text-embedding-3-small" : providerName === "yandex" ? "general:embedding" : "Embeddings",
    chatModelName: providerName === "openai" ? "gpt-4o-mini" : providerName === "openrouter" ? "openai/gpt-4o-mini" : providerName === "yandex" ? "yandexgpt" : "GigaChat",
    folderId: folderIdToUse || undefined,
  };

  const provider = AiProviderFactory.create(providerName, config);
  const start = Date.now();

  try {
    const result = await provider.generateEmbedding("Тестовый запрос для проверки соединения");
    const elapsed = Date.now() - start;

    let embeddingModels: { id: string; name?: string }[] = [];
    let chatModels: { id: string; name?: string }[] = [];

    try {
      const models = await listModelsForProvider(providerName, {
        apiKey: apiKeyToUse!,
        baseUrl: baseUrlToUse,
        folderId: folderIdToUse,
      });
      embeddingModels = models.embeddingModels;
      chatModels = models.chatModels;
    } catch (listErr) {
      console.warn("[UserAiConfig] List models failed:", listErr);
    }

    return NextResponse.json({
      ok: true,
      dimensions: result.dimensions,
      model: result.model,
      latencyMs: elapsed,
      embeddingModels,
      chatModels,
    });
  } catch (error) {
    const elapsed = Date.now() - start;
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: elapsed,
    }, { status: 200 });
  }
}
