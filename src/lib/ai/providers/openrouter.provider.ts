import type { AiProvider } from "../provider.interface";
import type { AiEmbeddingResult, AiAnalysisResult, AiProviderConfig, ChatMessage, ChatCompletionResult } from "../types";

export class OpenRouterProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private chatModel: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "openai/text-embedding-3-small";
    this.chatModel = config.chatModelName || "openai/gpt-4o-mini";
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
        encoding_format: "float",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    let raw =
      data.data?.[0]?.embedding ??
      (Array.isArray(data.data) ? data.data[0]?.embedding : undefined) ??
      (typeof data.data === "object" && data.data !== null && !Array.isArray(data.data)
        ? (data.data as { embedding?: unknown }).embedding
        : undefined) ??
      (Array.isArray(data) ? data[0]?.embedding : undefined) ??
      (typeof data.embedding !== "undefined" ? data.embedding : undefined);

    if (typeof raw === "string") {
      try {
        const binary = atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const float32 = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
        raw = Array.from(float32);
      } catch {
        throw new Error("OpenRouter returned invalid embedding format (base64 decode failed)");
      }
    }

    let embedding: number[] | undefined;
    if (Array.isArray(raw) && raw.length > 0) {
      embedding = raw.every((x) => typeof x === "number")
        ? (raw as number[])
        : (raw as unknown[]).map((x) => (typeof x === "number" ? x : Number(x)));
      if (embedding.some((n) => !Number.isFinite(n))) {
        embedding = undefined;
      }
    }

    if (!embedding || embedding.length === 0) {
      const snippet = JSON.stringify(data).slice(0, 500);
      console.error("[OpenRouter] Invalid embedding response structure:", snippet);
      throw new Error("OpenRouter returned invalid embedding format");
    }

    const vector = embedding;

    const rawUsage = data.usage && typeof data.usage === "object" ? (data.usage as Record<string, unknown>) : null;
    const usage =
      rawUsage
        ? {
            promptTokens:
              Number(rawUsage.input_tokens) ||
              Number(rawUsage.prompt_tokens) ||
              0,
            totalTokens: Number(rawUsage.total_tokens) || 0,
          }
        : undefined;

    return {
      vector,
      dimensions: vector.length,
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
    const msgs = options?.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }, ...messages]
      : messages;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://qoqon.ru",
        "X-Title": "qoqon.ru",
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter chat error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";
    const rawUsage = data.usage && typeof data.usage === "object" ? (data.usage as Record<string, unknown>) : null;
    const usage = rawUsage
      ? {
          promptTokens: Number(rawUsage.prompt_tokens) || Number(rawUsage.input_tokens) || 0,
          completionTokens: Number(rawUsage.completion_tokens) || Number(rawUsage.output_tokens) || 0,
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
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
