import type { AiProvider } from "../provider.interface";
import type { AiEmbeddingResult, AiAnalysisResult, AiProviderConfig } from "../types";

export class OpenRouterProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "openai/text-embedding-3-small";
  }

  async generateEmbedding(text: string): Promise<AiEmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qoqon.ru",
        "X-Title": "qoqon.ru",
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("OpenRouter returned invalid embedding format");
    }

    return {
      vector: embedding,
      dimensions: embedding.length,
      model: data.model ?? this.model,
    };
  }

  async analyzeDocument(_content: string): Promise<AiAnalysisResult> {
    return { summary: "", categories: [], entities: [] };
  }

  async generateImageDescription(_imageBuffer: Buffer): Promise<string> {
    return "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
