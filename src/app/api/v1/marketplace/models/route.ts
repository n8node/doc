import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromLlmKey } from "@/lib/llm-api-key-auth";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type MarketplaceCategory = "chat" | "embeddings" | "image" | "audio" | "video";

function inferCategory(model: {
  architecture?: { output_modalities?: string[]; input_modalities?: string[] };
  id?: string;
}): MarketplaceCategory {
  const out = model.architecture?.output_modalities ?? [];
  const inp = model.architecture?.input_modalities ?? [];
  const id = (model.id ?? "").toLowerCase();

  if (out.includes("image")) return "image";
  if (out.includes("speech") || inp.includes("audio")) return "audio";
  if (inp.includes("video")) return "video";
  if (id.includes("embed")) return "embeddings";
  return "chat";
}

/**
 * GET /api/v1/marketplace/models
 * Каталог моделей OpenRouter с категориями. Требует Bearer QoQon_LLM_xxx
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!token || !token.startsWith("QoQon_LLM_")) {
    return NextResponse.json(
      { error: "Требуется API-ключ LLM маркетплейса (Authorization: Bearer QoQon_LLM_xxx)" },
      { status: 401 }
    );
  }

  const userId = await getUserIdFromLlmKey(token);
  if (!userId) {
    return NextResponse.json({ error: "Недействительный API-ключ" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as MarketplaceCategory | null;

  let res: Response;
  try {
    res = await fetch(OPENROUTER_MODELS_URL);
  } catch (e) {
    console.error("[marketplace/models]", e);
    return NextResponse.json(
      { error: "Не удалось загрузить каталог моделей" },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { data?: Record<string, unknown>[] };
  const raw = data.data ?? [];

  const models = raw
    .filter((m) => m.id && typeof m.id === "string")
    .map((m) => {
      const cat = inferCategory(m as { architecture?: { output_modalities?: string[]; input_modalities?: string[] }; id?: string });
      return {
        id: m.id,
        name: m.name ?? m.id,
        category: cat,
        contextLength: (m as { context_length?: number }).context_length ?? null,
        pricing: (m as { pricing?: Record<string, string> }).pricing ?? null,
      };
    });

  const filtered = category && ["chat", "embeddings", "image", "audio", "video"].includes(category)
    ? models.filter((m) => m.category === category)
    : models;

  return NextResponse.json({
    data: filtered.slice(0, 200),
    categories: [
      { id: "chat", label: "Chat", icon: "💬" },
      { id: "embeddings", label: "Embeddings", icon: "📐" },
      { id: "image", label: "Изображения", icon: "🖼️" },
      { id: "audio", label: "Аудио", icon: "🎙️" },
      { id: "video", label: "Видео", icon: "🎬" },
    ] as const,
  });
}
