import { prisma } from "@/lib/prisma";
import { configStore } from "@/lib/config-store";
import { getActiveProvider } from "@/lib/ai/get-active-provider";
import { findSimilarForFile } from "@/lib/docling/vector-store";
import { hasEmbeddings } from "@/lib/docling/vector-store";

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

  const active = await getActiveProvider();
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

  const embResult = await active.provider.generateEmbedding(input.content);
  const similar = await findSimilarForFile(
    embResult.vector,
    input.fileId,
    input.userId,
    10,
    0.5,
  );

  const context =
    similar.length > 0
      ? similar
          .map((s) => s.chunkText)
          .join("\n\n")
      : "Контекст из документа не найден.";

  const enhancedSystem = `${systemPrompt}\n\n--- Контекст из документа ---\n${context}`;

  const messages = [
    ...history.map((h) => ({
      role: h.role as "user" | "assistant" | "system",
      content: h.content,
    })),
    { role: "user" as const, content: input.content },
  ];

  const completion = await active.provider.generateChatCompletion(messages, {
    systemPrompt: enhancedSystem,
  });

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
