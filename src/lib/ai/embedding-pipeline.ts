import { getProviderForUser } from "./get-provider-for-user";
import { chunkText, isNoiseChunk } from "./chunker";
import { insertEmbedding, deleteEmbeddingsByFileId } from "@/lib/docling/vector-store";
import { prisma } from "@/lib/prisma";
import {
  TokenQuotaExceededError,
  estimateTokensFromText,
  getCategoryQuotaState,
  recordTokenUsageEvent,
} from "./token-usage";
import {
  resolveEmbeddingConfigFromUser,
  toEmbeddingOptions,
  type ResolvedEmbeddingConfig,
} from "./embedding-config";

export interface EmbeddingPipelineResult {
  fileId: string;
  chunksCount: number;
  embeddingsCreated: number;
  providerName: string;
  dimensions: number;
  tokensUsed?: number;
}

export async function runEmbeddingPipeline(
  fileId: string,
  text: string,
  contentHash: string,
  userId: string,
  embeddingConfig?: ResolvedEmbeddingConfig | null,
): Promise<EmbeddingPipelineResult> {
  const active = await getProviderForUser(userId);
  if (!active) {
    throw new Error("Нет активного AI-провайдера. Настройте его в Админка → Настройки → AI-провайдеры");
  }

  const { provider, providerId, providerName, usedOwnKey } = active;

  let config: ResolvedEmbeddingConfig;
  if (embeddingConfig) {
    config = embeddingConfig;
  } else {
    let userConfigRaw: unknown = null;
    const userAiConfig = await prisma.userAiConfig.findUnique({
      where: { userId, isActive: true },
      select: { embeddingConfig: true },
    });
    if (userAiConfig?.embeddingConfig != null) {
      userConfigRaw = userAiConfig.embeddingConfig;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const prefs = user?.preferences as Record<string, unknown> | null;
      userConfigRaw = prefs?.embeddingConfig ?? null;
    }
    config = resolveEmbeddingConfigFromUser(userConfigRaw);
  }

  const embeddingOptions = toEmbeddingOptions(config);

  const task = await prisma.aiTask.create({
    data: {
      type: "EMBEDDING",
      status: "processing",
      userId,
      fileId,
      providerId: usedOwnKey ? null : providerId,
      usedOwnKey: usedOwnKey || undefined,
      input: { action: "embedding", contentHash, textLength: text.length },
    },
  });

  try {
    await deleteEmbeddingsByFileId(fileId);

    const chunks = chunkText(text, config.chunkSize, config.chunkOverlap, config.chunkStrategy);
    if (chunks.length === 0) {
      await prisma.aiTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
          usedOwnKey: usedOwnKey || undefined,
          output: { chunksCount: 0, embeddingsCreated: 0, reason: "empty text" },
          completedAt: new Date(),
        },
      });
      return { fileId, chunksCount: 0, embeddingsCreated: 0, providerName, dimensions: 0, tokensUsed: undefined };
    }

    let dimensions = 0;
    let created = 0;
    let totalPromptTokens = 0;
    let totalTokens = 0;
    let modelName: string | undefined;
    const quotaState = !usedOwnKey
      ? await getCategoryQuotaState({ userId, category: "EMBEDDING" })
      : null;
    let projectedTokens = quotaState?.used ?? 0;

    for (const chunk of chunks) {
      if (isNoiseChunk(chunk.text)) continue;
      if (quotaState?.hasQuota && quotaState.quota != null) {
        const estimated = estimateTokensFromText(chunk.text, {
          charsPerToken: 3.2,
          min: 40,
          extra: 12,
        });
        projectedTokens += estimated;
        if (projectedTokens > quotaState.quota) {
          throw new TokenQuotaExceededError({
            category: "EMBEDDING",
            quota: quotaState.quota,
            used: quotaState.used,
            requested: estimated,
          });
        }
      }
      const result = await provider.generateEmbedding(chunk.text, embeddingOptions);
      if (result.vector.length === 0) continue;

      dimensions = result.dimensions;
      if (result.model && !modelName) modelName = result.model;
      if (result.usage) {
        totalPromptTokens += result.usage.promptTokens;
        totalTokens += result.usage.totalTokens;
      }
      const id = `${fileId}_chunk_${chunk.index}`;
      await insertEmbedding({
        id,
        fileId,
        vector: result.vector,
        chunkText: chunk.text,
        contentHash,
        chunkIndex: chunk.index,
        metadata: {
          startChar: chunk.startChar,
          endChar: chunk.endChar,
          model: result.model,
          providerName,
        },
      });
      created++;
    }

    const tokensUsed = totalTokens > 0 ? totalTokens : totalPromptTokens > 0 ? totalPromptTokens : undefined;
    if ((tokensUsed ?? 0) > 0) {
      await recordTokenUsageEvent({
        userId,
        category: "EMBEDDING",
        sourceType: "embedding",
        sourceId: fileId,
        tokensIn: totalPromptTokens > 0 ? totalPromptTokens : tokensUsed,
        tokensTotal: tokensUsed,
        provider: providerName,
        model: modelName ?? undefined,
        isBillable: !usedOwnKey,
        metadata: { chunksCount: chunks.length, embeddingsCreated: created },
      });
    }

    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        usedOwnKey: usedOwnKey || undefined,
        output: {
          chunksCount: chunks.length,
          embeddingsCreated: created,
          dimensions,
          providerName,
          ...(modelName && { modelName }),
          ...(tokensUsed != null && { tokensUsed, promptTokens: totalPromptTokens }),
        },
        completedAt: new Date(),
      },
    });

    const existingMeta = await getExistingAiMetadata(fileId);
    await prisma.file.update({
      where: { id: fileId },
      data: {
        hasEmbedding: created > 0,
        aiMetadata: {
          ...existingMeta,
          embeddingsCount: created,
          embeddingsDimensions: dimensions,
          embeddingsProvider: providerName,
          embeddingsCreatedAt: new Date().toISOString(),
          ...(tokensUsed != null && { embeddingTokensUsed: tokensUsed }),
        },
      },
    });

    return {
      fileId,
      chunksCount: chunks.length,
      embeddingsCreated: created,
      providerName,
      dimensions,
      tokensUsed,
    };
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function getExistingAiMetadata(fileId: string): Promise<Record<string, unknown>> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { aiMetadata: true },
  });
  if (file?.aiMetadata && typeof file.aiMetadata === "object") {
    return file.aiMetadata as Record<string, unknown>;
  }
  return {};
}
