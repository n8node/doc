/**
 * Fetch available embedding and chat models from AI providers.
 * OpenAI and OpenRouter: fetch from API.
 * Yandex and GigaChat: use predefined known models.
 */

export interface ModelInfo {
  id: string;
  name?: string;
}

export interface ListModelsResult {
  embeddingModels: ModelInfo[];
  chatModels: ModelInfo[];
}

const YANDEX_EMBEDDING_MODELS: ModelInfo[] = [
  { id: "general:embedding" },
];

const YANDEX_CHAT_MODELS: ModelInfo[] = [
  { id: "yandexgpt" },
  { id: "yandexgpt/latest" },
];

const GIGACHAT_EMBEDDING_MODELS: ModelInfo[] = [
  { id: "Embeddings" },
];

const GIGACHAT_CHAT_MODELS: ModelInfo[] = [
  { id: "GigaChat" },
  { id: "GigaChat-Pro" },
];

async function fetchOpenAIModels(
  baseUrl: string,
  apiKey: string,
): Promise<ListModelsResult> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models API error ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id: string; owned_by?: string }> };
  const all = data.data ?? [];
  const embeddingIds = new Set([
    "text-embedding-3-small",
    "text-embedding-3-large",
    "text-embedding-ada-002",
  ]);
  const embeddingModels: ModelInfo[] = [];
  const chatModels: ModelInfo[] = [];
  for (const m of all) {
    if (embeddingIds.has(m.id)) {
      embeddingModels.push({ id: m.id });
    } else if (
      m.id.startsWith("gpt-") ||
      m.id.startsWith("o1-") ||
      m.id.includes("chat")
    ) {
      chatModels.push({ id: m.id });
    }
  }
  if (embeddingModels.length === 0) {
    embeddingModels.push(
      { id: "text-embedding-3-small" },
      { id: "text-embedding-3-large" },
    );
  }
  if (chatModels.length === 0) {
    chatModels.push(
      { id: "gpt-4o-mini" },
      { id: "gpt-4o" },
      { id: "gpt-4-turbo" },
    );
  }
  return { embeddingModels, chatModels };
}

async function fetchOpenRouterModels(
  baseUrl: string,
  apiKey: string,
): Promise<ListModelsResult> {
  const [modelsRes, embRes] = await Promise.all([
    fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    fetch(`${baseUrl.replace(/\/$/, "")}/models/embeddings`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).catch(() => null),
  ]);
  if (!modelsRes.ok) throw new Error(`OpenRouter models API error ${modelsRes.status}`);

  const modelsData = (await modelsRes.json()) as {
    data?: Array<{ id: string; name?: string }>;
  };
  const chatModels: ModelInfo[] = (modelsData.data ?? [])
    .filter((m) => m.id && !m.id.includes("embedding"))
    .map((m) => ({ id: m.id, name: m.name }))
    .slice(0, 100);

  let embeddingModels: ModelInfo[] = [];
  if (embRes?.ok) {
    const embData = (await embRes.json()) as { data?: Array<{ id: string }> };
    embeddingModels = (embData.data ?? []).map((m) => ({ id: m.id }));
  }
  if (embeddingModels.length === 0) {
    embeddingModels = [
      { id: "openai/text-embedding-3-small" },
      { id: "openai/text-embedding-3-large" },
    ];
  }
  if (chatModels.length === 0) {
    chatModels.push(
      { id: "openai/gpt-4o-mini" },
      { id: "openai/gpt-4o" },
    );
  }
  return { embeddingModels, chatModels };
}

export async function listModelsForProvider(
  providerName: string,
  options: { apiKey: string; baseUrl?: string; folderId?: string },
): Promise<ListModelsResult> {
  const { apiKey, baseUrl } = options;
  if (!apiKey?.trim()) throw new Error("API key required");

  switch (providerName) {
    case "openai": {
      const url = baseUrl ?? "https://api.openai.com/v1";
      return fetchOpenAIModels(url, apiKey.trim());
    }
    case "openrouter": {
      const url = baseUrl ?? "https://openrouter.ai/api/v1";
      return fetchOpenRouterModels(url, apiKey.trim());
    }
    case "yandex":
      return {
        embeddingModels: YANDEX_EMBEDDING_MODELS,
        chatModels: YANDEX_CHAT_MODELS,
      };
    case "gigachat":
      return {
        embeddingModels: GIGACHAT_EMBEDDING_MODELS,
        chatModels: GIGACHAT_CHAT_MODELS,
      };
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
