import { prisma } from "@/lib/prisma";
import { configStore } from "@/lib/config-store";
import { getProviderForUser } from "@/lib/ai/get-provider-for-user";
import { findSimilarForFile, getChunksForFile } from "@/lib/docling/vector-store";
import { hasEmbeddings } from "@/lib/docling/vector-store";
import {
  TokenQuotaExceededError,
  estimateTokensFromText,
  getCategoryQuotaState,
  recordTokenUsageEvent,
} from "@/lib/ai/token-usage";
import { resolveEmbeddingConfigFromUser } from "@/lib/ai/embedding-config";

const DEFAULT_SYSTEM_PROMPT =
  "Ты — полезный ассистент. Отвечай на вопросы пользователя на основе приведённого ниже контекста из документа. " +
  "Если в контексте нет ответа, скажи об этом. Отвечай кратко и по существу.";

export interface SendMessageInput {
  fileId: string;
  userId: string;
  content: string;
}

export interface SendMessageResult {
  messageId: string;
  content: string;
  role: "assistant";
}

export async function sendDocumentChatMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const file = await prisma.file.findFirst({
    where: {
      id: input.fileId,
      userId: input.userId,
      deletedAt: null,
    },
  });

  if (!file) {
    throw new Error("File not found");
  }

  const hasVec = await hasEmbeddings(input.fileId);
  if (!hasVec) {
    throw new Error("Документ не обработан. Запустите обработку документа для чата.");
  }

  const active = await getProviderForUser(input.userId);
  if (!active) {
    throw new Error("AI-провайдер не настроен. Обратитесь к администратору.");
  }

  const systemPrompt =
    (await configStore.get("ai.chat_system_prompt")) || DEFAULT_SYSTEM_PROMPT;

  const history = await prisma.documentChatMessage.findMany({
    where: { fileId: input.fileId, userId: input.userId },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { role: true, content: true },
  });

  const chatQuotaState = !active.usedOwnKey
    ? await getCategoryQuotaState({
      userId: input.userId,
      category: "CHAT_DOCUMENT",
    })
    : null;

  let projectedTokens = chatQuotaState?.used ?? 0;
  if (chatQuotaState?.hasQuota && chatQuotaState.quota != null) {
    const embeddingEstimate = estimateTokensFromText(input.content, {
      charsPerToken: 3.2,
      min: 64,
      extra: 24,
    });
    projectedTokens += embeddingEstimate;
    if (projectedTokens > chatQuotaState.quota) {
      throw new TokenQuotaExceededError({
        category: "CHAT_DOCUMENT",
        quota: chatQuotaState.quota,
        used: chatQuotaState.used,
        requested: embeddingEstimate,
      });
    }
  }

  const userEmbedConfig = await prisma.userAiConfig.findUnique({
    where: { userId: input.userId, isActive: true },
    select: { embeddingConfig: true },
  });
  const embedConfig = resolveEmbeddingConfigFromUser(userEmbedConfig?.embeddingConfig ?? null);

  const embResult = await active.provider.generateEmbedding(input.content);
  const contextTokens = embResult.usage?.totalTokens ?? embResult.usage?.promptTokens ?? 0;
  const similar = await findSimilarForFile(
    embResult.vector,
    input.fileId,
    input.userId,
    embedConfig.topK,
    embedConfig.similarityThreshold,
  );

  let context: string;
  if (similar.length > 0) {
    context = similar.map((s) => s.chunkText).join("\n\n");
  } else {
    const fallbackChunks = await getChunksForFile(input.fileId, input.userId, Math.max(15, embedConfig.topK));
    context =
      fallbackChunks.length > 0
        ? fallbackChunks.map((c) => c.chunkText).join("\n\n")
        : "Контекст из документа не найден.";
  }

  const enhancedSystem = `${systemPrompt}\n\n--- Контекст из документа ---\n${context}`;

  const messages = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content,
    })),
    { role: "user" as const, content: input.content },
  ];

  if (chatQuotaState?.hasQuota && chatQuotaState.quota != null) {
    const historyText = history.map((h) => h.content).join("\n");
    const promptEstimate = estimateTokensFromText(
      `${enhancedSystem}\n${historyText}\n${input.content}`,
      { charsPerToken: 3.4, min: 220 },
    );
    const completionReserve = Math.min(
      2200,
      Math.max(600, Math.ceil(promptEstimate * 0.45)),
    );
    const requestEstimate = promptEstimate + completionReserve;
    projectedTokens += requestEstimate;
    if (projectedTokens > chatQuotaState.quota) {
      throw new TokenQuotaExceededError({
        category: "CHAT_DOCUMENT",
        quota: chatQuotaState.quota,
        used: chatQuotaState.used,
        requested: requestEstimate,
      });
    }
  }

  const completion = await active.provider.generateChatCompletion(messages, {
    systemPrompt: enhancedSystem,
  });

  const usage = completion.usage;
  const completionTokens = usage
    ? (usage.totalTokens ?? usage.promptTokens + usage.completionTokens)
    : 0;
  const totalTokens = completionTokens + contextTokens;
  if (totalTokens > 0) {
    await recordTokenUsageEvent({
      userId: input.userId,
      category: "CHAT_DOCUMENT",
      sourceType: "document_chat",
      sourceId: input.fileId,
      tokensIn: (usage?.promptTokens ?? 0) + contextTokens,
      tokensOut: usage?.completionTokens ?? 0,
      tokensTotal: totalTokens,
      provider: active.providerName,
      model: completion.model ?? active.providerName,
      isBillable: !active.usedOwnKey,
      metadata: { contextEmbeddingTokens: contextTokens },
    });

    await prisma.aiTask.create({
      data: {
        type: "CHAT",
        status: "completed",
        userId: input.userId,
        fileId: input.fileId,
        providerId: active.usedOwnKey ? null : active.providerId,
        usedOwnKey: active.usedOwnKey || undefined,
        input: { action: "chat", fileId: input.fileId },
        output: {
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: completionTokens,
          model: completion.model ?? active.providerName,
        },
        completedAt: new Date(),
      },
    });
  }

  const [, assistantMsg] = await prisma.$transaction([
    prisma.documentChatMessage.create({
      data: {
        fileId: input.fileId,
        userId: input.userId,
        role: "user",
        content: input.content,
      },
      select: { id: true },
    }),
    prisma.documentChatMessage.create({
      data: {
        fileId: input.fileId,
        userId: input.userId,
        role: "assistant",
        content: completion.content,
      },
      select: { id: true, content: true },
    }),
  ]);

  return {
    messageId: assistantMsg.id,
    content: assistantMsg.content,
    role: "assistant",
  };
}

export async function getDocumentChatHistory(
  fileId: string,
  userId: string,
  limit = 100,
) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
  });
  if (!file) return null;

  const messages = await prisma.documentChatMessage.findMany({
    where: { fileId, userId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return messages;
}
