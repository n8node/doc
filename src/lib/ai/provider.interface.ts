import type { AiEmbeddingResult, AiAnalysisResult } from "./types";

export abstract class AiProvider {
  abstract generateEmbedding(text: string): Promise<AiEmbeddingResult>;
  abstract analyzeDocument(content: string, options?: unknown): Promise<AiAnalysisResult>;
  abstract generateImageDescription(imageBuffer: Buffer): Promise<string>;
  abstract isAvailable(): Promise<boolean>;
}
