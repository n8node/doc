import type { AiProvider } from "../provider.interface";
import type {
  AiEmbeddingResult,
  AiEmbeddingOptions,
  AiAnalysisResult,
  AiProviderConfig,
  ChatMessage,
  ChatCompletionResult,
} from "../types";

export class YandexProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private chatModel: string;
  private folderId: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://llm.api.cloud.yandex.net").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "general:embedding";
    this.chatModel = config.chatModelName || "yandexgpt";
    this.folderId = config.folderId ?? "";
  }

  async generateEmbedding(text: string, _options?: AiEmbeddingOptions): Promise<AiEmbeddingResult> {
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

    const usage =
      data.usage && typeof data.usage === "object"
        ? {
            promptTokens: Number((data.usage as { inputTextTokens?: number }).inputTextTokens) || 0,
            totalTokens: Number((data.usage as { totalTokens?: number }).totalTokens) || 0,
          }
        : undefined;

    return {
      vector: embedding,
      dimensions: embedding.length,
      model: this.model,
      usage,
    };
  }

  async analyzeDocument(_content: string): Promise<AiAnalysisResult> {
    return { summary: "", categories: [], entities: [] };
  }

  async generateImageDescription(_imageBuffer: Buffer): Promise<string> {
    return "";
  }

  async generateChatCompletion(
    messages: ChatMessage[],
    options?: { systemPrompt?: string },
  ): Promise<ChatCompletionResult> {
    const modelUri = `gpt://${this.folderId}/${this.chatModel}/latest`;
    const yandexMessages: Array<{ role: string; text: string }> = [];

    if (options?.systemPrompt) {
      yandexMessages.push({ role: "system", text: options.systemPrompt });
    }
    for (const m of messages) {
      yandexMessages.push({ role: m.role, text: m.content });
    }

    const res = await fetch(`${this.baseUrl}/foundationModels/v1/completion`, {
      method: "POST",
      headers: {
        Authorization: `Api-Key ${this.apiKey}`,
        "Content-Type": "application/json",
        "x-folder-id": this.folderId,
      },
      body: JSON.stringify({
        modelUri,
        completionOptions: { stream: false, temperature: 0.6, maxTokens: 2000 },
        messages: yandexMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Yandex chat error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const result = data.result?.alternatives?.[0];
    const content = result?.message?.text ?? "";
    const usage = data.usage
      ? {
          promptTokens: Number(data.usage.inputTextTokens) || 0,
          completionTokens: Number(data.usage.completionTokens) || 0,
          totalTokens: Number(data.usage.inputTextTokens ?? 0) + Number(data.usage.completionTokens ?? 0),
        }
      : undefined;

    return {
      content,
      model: this.chatModel,
      usage,
    };
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
