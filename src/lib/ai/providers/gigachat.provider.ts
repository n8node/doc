import type { AiProvider } from "../provider.interface";
import type {
  AiEmbeddingResult,
  AiEmbeddingOptions,
  AiAnalysisResult,
  AiProviderConfig,
  ChatMessage,
  ChatCompletionResult,
} from "../types";

export class GigaChatProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private chatModel: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://gigachat.devices.sberbank.ru/api/v1").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "Embeddings";
    this.chatModel = config.chatModelName || "GigaChat";
  }

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const res = await fetch("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        RqUID: crypto.randomUUID(),
      },
      body: "scope=GIGACHAT_API_PERS",
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GigaChat auth error ${res.status}: ${err}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = data.expires_at ?? Date.now() + 29 * 60 * 1000;
    return this.accessToken!;
  }

  async generateEmbedding(text: string, _options?: AiEmbeddingOptions): Promise<AiEmbeddingResult> {
    const token = await this.ensureToken();

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: [text],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GigaChat embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("GigaChat returned invalid embedding format");
    }

    const usage =
      data.usage && typeof data.usage === "object"
        ? {
            promptTokens: Number((data.usage as { prompt_tokens?: number }).prompt_tokens) || 0,
            totalTokens: Number((data.usage as { total_tokens?: number }).total_tokens) || 0,
          }
        : undefined;

    return {
      vector: embedding,
      dimensions: embedding.length,
      model: data.model ?? this.model,
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
    const token = await this.ensureToken();
    const msgs = options?.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }, ...messages]
      : messages;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GigaChat chat error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";
    const rawUsage = data.usage && typeof data.usage === "object" ? (data.usage as Record<string, unknown>) : null;
    const usage = rawUsage
      ? {
          promptTokens: Number(rawUsage.prompt_tokens) || 0,
          completionTokens: Number(rawUsage.completion_tokens) || 0,
          totalTokens: Number(rawUsage.total_tokens) || 0,
        }
      : undefined;

    return {
      content,
      model: data.model ?? this.chatModel,
      usage,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureToken();
      return true;
    } catch {
      return false;
    }
  }
}
