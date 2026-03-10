import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { getUserPlan } from "@/lib/plan-service";
import { prisma } from "@/lib/prisma";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/lib/ai/encrypt";

function canUseOwnKeys(features: Record<string, boolean> | undefined): boolean {
  return features?.own_ai_keys === true;
}

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getUserPlan(userId);
  if (!canUseOwnKeys(plan?.features as Record<string, boolean>)) {
    return NextResponse.json({
      canUseOwnKeys: false,
      config: null,
    });
  }

  const config = await prisma.userAiConfig.findUnique({
    where: { userId },
  });
  if (!config) {
    return NextResponse.json({
      canUseOwnKeys: true,
      config: null,
    });
  }

  return NextResponse.json({
    canUseOwnKeys: true,
    config: {
      id: config.id,
      providerName: config.providerName,
      baseUrl: config.baseUrl,
      embeddingModel: config.embeddingModel,
      chatModel: config.chatModel,
      embeddingConfig: config.embeddingConfig,
      isActive: config.isActive,
      hasApiKey: !!config.apiKey,
      apiKeyMasked: config.apiKey ? maskApiKey(decryptApiKey(config.apiKey)) : null,
      folderId: config.folderId,
      updatedAt: config.updatedAt.toISOString(),
    },
  });
}

export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await getUserPlan(userId);
  if (!canUseOwnKeys(plan?.features as Record<string, boolean>)) {
    return NextResponse.json(
      { error: "Использование собственного API-ключа недоступно на вашем тарифе" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validProviders = ["openai", "openrouter", "yandex", "gigachat"];
  const providerName = body.providerName as string | undefined;
  if (providerName && !validProviders.includes(providerName)) {
    return NextResponse.json({ error: "Недопустимый провайдер" }, { status: 400 });
  }

  const existing = await prisma.userAiConfig.findUnique({
    where: { userId },
  });

  const data: Record<string, unknown> = {};
  if (providerName !== undefined) data.providerName = providerName;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl || null;
  if (body.folderId !== undefined) data.folderId = body.folderId || null;
  if (body.embeddingModel !== undefined) data.embeddingModel = body.embeddingModel || "text-embedding-3-small";
  if (body.chatModel !== undefined) data.chatModel = body.chatModel || "gpt-4o-mini";
  if (body.embeddingConfig !== undefined) {
    const ec = body.embeddingConfig as Record<string, unknown> | null;
    if (ec === null || (typeof ec === "object" && ec !== null)) {
      const valid: Record<string, unknown> = {};
      if (typeof ec?.chunkSize === "number") valid.chunkSize = Math.min(2000, Math.max(100, ec.chunkSize));
      if (typeof ec?.chunkOverlap === "number") valid.chunkOverlap = Math.min(200, Math.max(0, ec.chunkOverlap));
      if (ec?.chunkStrategy === "paragraphs" || ec?.chunkStrategy === "sentences" || ec?.chunkStrategy === "fixed") {
        valid.chunkStrategy = ec.chunkStrategy;
      }
      if (ec?.dimensions === null) valid.dimensions = null;
      else if (typeof ec?.dimensions === "number") valid.dimensions = Math.min(3072, Math.max(256, ec.dimensions));
      if (typeof ec?.similarityThreshold === "number") {
        valid.similarityThreshold = Math.min(0.95, Math.max(0.3, ec.similarityThreshold));
      }
      if (typeof ec?.topK === "number") valid.topK = Math.min(50, Math.max(1, ec.topK));
      data.embeddingConfig = Object.keys(valid).length > 0 ? valid : null;
    }
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim()) {
    data.apiKey = encryptApiKey(body.apiKey.trim());
  }

  if (existing) {
    const updated = await prisma.userAiConfig.update({
      where: { userId },
      data: data as never,
    });
    return NextResponse.json({
      ok: true,
      config: {
        id: updated.id,
        providerName: updated.providerName,
        embeddingModel: updated.embeddingModel,
        chatModel: updated.chatModel,
        embeddingConfig: updated.embeddingConfig,
        isActive: updated.isActive,
        hasApiKey: !!updated.apiKey,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }

  const embedConfig = body.embeddingConfig as Record<string, unknown> | undefined;
  let embedConfigData: Record<string, unknown> | null = null;
  if (embedConfig && typeof embedConfig === "object") {
    const valid: Record<string, unknown> = {};
    if (typeof embedConfig.chunkSize === "number") valid.chunkSize = Math.min(2000, Math.max(100, embedConfig.chunkSize));
    if (typeof embedConfig.chunkOverlap === "number") valid.chunkOverlap = Math.min(200, Math.max(0, embedConfig.chunkOverlap));
    if (["paragraphs", "sentences", "fixed"].includes(embedConfig.chunkStrategy as string)) valid.chunkStrategy = embedConfig.chunkStrategy;
    if (embedConfig.dimensions === null) valid.dimensions = null;
    else if (typeof embedConfig.dimensions === "number") valid.dimensions = Math.min(3072, Math.max(256, embedConfig.dimensions));
    if (typeof embedConfig.similarityThreshold === "number") valid.similarityThreshold = Math.min(0.95, Math.max(0.3, embedConfig.similarityThreshold));
    if (typeof embedConfig.topK === "number") valid.topK = Math.min(50, Math.max(1, embedConfig.topK));
    if (Object.keys(valid).length > 0) embedConfigData = valid;
  }

  const created = await prisma.userAiConfig.create({
    data: {
      userId,
      providerName: providerName || "openai",
      baseUrl: (body.baseUrl as string) || null,
      apiKey: body.apiKey && typeof body.apiKey === "string" && body.apiKey.trim()
        ? encryptApiKey(body.apiKey.trim())
        : null,
      folderId: (body.folderId as string) || null,
      embeddingModel: (body.embeddingModel as string) || "text-embedding-3-small",
      chatModel: (body.chatModel as string) || "gpt-4o-mini",
      ...(embedConfigData && { embeddingConfig: embedConfigData as Prisma.InputJsonValue }),
      isActive: !!body.isActive,
    },
  });
  return NextResponse.json({
    ok: true,
    config: {
      id: created.id,
      providerName: created.providerName,
      embeddingModel: created.embeddingModel,
      chatModel: created.chatModel,
      embeddingConfig: created.embeddingConfig,
      isActive: created.isActive,
      hasApiKey: !!created.apiKey,
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
