import { getActiveProvider } from "./get-active-provider";
import { chunkText } from "./chunker";
import { insertEmbedding, deleteEmbeddingsByFileId } from "@/lib/docling/vector-store";
import { prisma } from "@/lib/prisma";

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
): Promise<EmbeddingPipelineResult> {
  const active = await getActiveProvider();
  if (!active) {
    throw new Error("Нет активного AI-провайдера. Настройте его в Админка → Настройки → AI-провайдеры");
  }

  const { provider, providerId, providerName } = active;

  const task = await prisma.aiTask.create({
    data: {
      type: "EMBEDDING",
      status: "processing",
      userId,
      fileId,
      providerId,
      input: { action: "embedding", contentHash, textLength: text.length },
    },
  });

  try {
    await deleteEmbeddingsByFileId(fileId);

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await prisma.aiTask.update({
        where: { id: task.id },
        data: {
          status: "completed",
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

    for (const chunk of chunks) {
      const result = await provider.generateEmbedding(chunk.text);
      if (result.vector.length === 0) continue;

      dimensions = result.dimensions;
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

    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "completed",
        output: {
          chunksCount: chunks.length,
          embeddingsCreated: created,
          dimensions,
          providerName,
          ...(tokensUsed != null && { tokensUsed, promptTokens: totalPromptTokens }),
        },
        completedAt: new Date(),
      },
    });

    const existingMeta = await getExistingAiMetadata(fileId);
    await prisma.file.update({
      where: { id: fileId },
      data: {
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
