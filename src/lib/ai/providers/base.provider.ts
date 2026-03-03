import type { AiProvider } from "../provider.interface";
import type { AiEmbeddingResult, AiAnalysisResult } from "../types";

/**
 * Базовый провайдер-заглушка для dev и fallback
 */
export class BaseAiProvider implements AiProvider {
  async generateEmbedding(_text: string): Promise<AiEmbeddingResult> {
    return {
      vector: [],
      dimensions: 0,
      model: "base-stub",
    };
  }

  async analyzeDocument(_content: string): Promise<AiAnalysisResult> {
    return { summary: "", categories: [], entities: [] };
  }

  async generateImageDescription(_imageBuffer: Buffer): Promise<string> {
    return "";
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
