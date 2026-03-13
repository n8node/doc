import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromLlmKey } from "@/lib/llm-api-key-auth";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/models/embeddings";

/**
 * GET /api/v1/marketplace/models
 * OpenAI-compatible models list. Requires Bearer QoQon_LLM_xxx.
 *
 * Response format follows OpenAI GET /v1/models spec:
 *   { object: "list", data: [{ id, object: "model", created, owned_by }] }
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  if (!token || !token.startsWith("QoQon_LLM_")) {
    return NextResponse.json(
      { error: { message: "Requires LLM marketplace API key (Authorization: Bearer QoQon_LLM_xxx)", type: "invalid_request_error" } },
      { status: 401 },
    );
  }

  const userId = await getUserIdFromLlmKey(token);
  if (!userId) {
    return NextResponse.json(
      { error: { message: "Invalid API key", type: "invalid_request_error" } },
      { status: 401 },
    );
  }

  let modelsRes: Response;
  let embRes: Response | null = null;
  try {
    [modelsRes, embRes] = await Promise.all([
      fetch(OPENROUTER_MODELS_URL),
      fetch(OPENROUTER_EMBEDDINGS_URL).catch(() => null),
    ]);
  } catch (e) {
    console.error("[marketplace/models]", e);
    return NextResponse.json(
      { error: { message: "Failed to load models catalog", type: "server_error" } },
      { status: 502 },
    );
  }

  if (!modelsRes.ok) {
    return NextResponse.json(
      { error: { message: "Failed to load models catalog", type: "server_error" } },
      { status: 502 },
    );
  }

  const data = (await modelsRes.json()) as { data?: Record<string, unknown>[] };
  const raw = data.data ?? [];

  let embeddingModels: { id: string; name?: string }[] = [];
  if (embRes?.ok) {
    const embData = (await embRes.json()) as { data?: Array<{ id: string; name?: string }> };
    embeddingModels = embData.data ?? [];
  }
  if (embeddingModels.length === 0) {
    embeddingModels = [
      { id: "openai/text-embedding-3-small" },
      { id: "openai/text-embedding-3-large" },
      { id: "text-embedding-3-small" },
      { id: "text-embedding-3-large" },
      { id: "text-embedding-ada-002" },
    ];
  }

  const now = Math.floor(Date.now() / 1000);
  const seenIds = new Set<string>();

  type OpenAIModel = {
    id: string;
    object: "model";
    created: number;
    owned_by: string;
  };

  const models: OpenAIModel[] = [];

  for (const m of raw) {
    if (!m.id || typeof m.id !== "string") continue;
    if (seenIds.has(m.id as string)) continue;
    seenIds.add(m.id as string);

    const created = typeof m.created === "number"
      ? m.created
      : (typeof (m as { created_at?: number }).created_at === "number"
        ? (m as { created_at?: number }).created_at!
        : now);

    models.push({
      id: m.id as string,
      object: "model",
      created,
      owned_by: (typeof (m as { owned_by?: string }).owned_by === "string"
        ? (m as { owned_by?: string }).owned_by!
        : "openrouter"),
    });
  }

  for (const m of embeddingModels) {
    if (!m.id || seenIds.has(m.id)) continue;
    seenIds.add(m.id);
    models.push({
      id: m.id,
      object: "model",
      created: now,
      owned_by: "openrouter",
    });
  }

  return NextResponse.json({ object: "list", data: models });
}
