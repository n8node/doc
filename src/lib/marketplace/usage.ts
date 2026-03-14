/**
 * Парсинг usage из ответа OpenRouter.
 * Учитывает разные форматы (chat, embeddings, image/video).
 */
export function parseUsageTokens(usage: Record<string, unknown> | undefined): {
  tokensIn: number;
  tokensOut: number;
} {
  if (!usage || typeof usage !== "object") {
    return { tokensIn: 0, tokensOut: 0 };
  }
  const p = (usage.prompt_tokens ?? usage.input_tokens) as number | undefined;
  const c = (usage.completion_tokens ?? usage.output_tokens) as number | undefined;
  const total = usage.total_tokens as number | undefined;

  let tokensIn = typeof p === "number" && p >= 0 ? p : 0;
  const tokensOut = typeof c === "number" && c >= 0 ? c : 0;

  if (tokensIn === 0 && tokensOut === 0 && typeof total === "number" && total > 0) {
    tokensIn = total;
  }

  return { tokensIn, tokensOut };
}

export type MarketplaceCategory = "chat" | "embeddings" | "image" | "audio" | "video";

/**
 * Определить категорию по modalities в body и/или model id.
 */
export function inferCategory(
  body: Record<string, unknown> | null,
  modelId: string
): MarketplaceCategory {
  const mods = body?.modalities;
  if (Array.isArray(mods)) {
    if (mods.includes("image")) return "image";
    if (mods.includes("video")) return "video";
    if (mods.includes("audio") || mods.some((m) => String(m).includes("speech")))
      return "audio";
  }
  const id = modelId.toLowerCase();
  if (id.includes("flux") || id.includes("dall") || id.includes("image")) return "image";
  if (id.includes("embed")) return "embeddings";
  return "chat";
}
