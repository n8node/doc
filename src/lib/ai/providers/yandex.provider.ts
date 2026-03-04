import type { AiProvider } from "../provider.interface";
import type { AiEmbeddingResult, AiAnalysisResult, AiProviderConfig } from "../types";

export class YandexProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private folderId: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://llm.api.cloud.yandex.net").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "general:embedding";
    this.folderId = config.folderId ?? "";
  }

  async generateEmbedding(text: string): Promise<AiEmbeddingResult> {
    const modelUri = `emb://${this.folderId}/${this.model}`;

    const res = await fetch(
      `${this.baseUrl}/foundationModels/v1/textEmbedding`,
      {
        method: "POST",
        headers: {
          Authorization: `Api-Key ${this.apiKey}`,
          "Content-Type": "application/json",
          "x-folder-id": this.folderId,
        },
        body: JSON.stringify({
          modelUri,
          text,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Yandex embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const embedding = data.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("Yandex returned invalid embedding format");
    }

    return {
      vector: embedding,
      dimensions: embedding.length,
      model: this.model,
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
      const res = await fetch(
        `${this.baseUrl}/foundationModels/v1/textEmbedding`,
        {
          method: "POST",
          headers: {
            Authorization: `Api-Key ${this.apiKey}`,
            "Content-Type": "application/json",
            "x-folder-id": this.folderId,
          },
          body: JSON.stringify({
            modelUri: `emb://${this.folderId}/${this.model}`,
            text: "test",
          }),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
