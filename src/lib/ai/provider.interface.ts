import type { AiEmbeddingResult, AiAnalysisResult, ChatMessage, ChatCompletionResult } from "./types";

export abstract class AiProvider {
  abstract generateEmbedding(text: string): Promise<AiEmbeddingResult>;
  abstract analyzeDocument(content: string, options?: unknown): Promise<AiAnalysisResult>;
  abstract generateImageDescription(imageBuffer: Buffer): Promise<string>;
  abstract generateChatCompletion(messages: ChatMessage[], options?: { systemPrompt?: string }): Promise<ChatCompletionResult>;
  abstract isAvailable(): Promise<boolean>;
}
