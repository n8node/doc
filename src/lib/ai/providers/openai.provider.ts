import type { AiProvider } from "../provider.interface";
import type { AiEmbeddingResult, AiAnalysisResult, AiProviderConfig, ChatMessage, ChatCompletionResult } from "../types";

export class OpenAiProvider implements AiProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private chatModel: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.apiKey = config.apiKey ?? "";
    this.model = config.modelName || "text-embedding-3-small";
    this.chatModel = config.chatModelName || "gpt-4o-mini";
  }

  async generateEmbedding(text: string): Promise<AiEmbeddingResult> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embeddings error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("OpenAI returned invalid embedding format");
    }

    const usage = data.usage
      ? {
          promptTokens: Number(data.usage.prompt_tokens) || 0,
          totalTokens: Number(data.usage.total_tokens) || 0,
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
    const msgs = options?.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }, ...messages]
      : messages;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI chat error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content ?? "";
    const usage = data.usage
      ? {
          promptTokens: Number(data.usage.prompt_tokens) || 0,
          completionTokens: Number(data.usage.completion_tokens) || 0,
          totalTokens: Number(data.usage.total_tokens) || 0,
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
