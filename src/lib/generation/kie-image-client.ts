const KIE_BASE = "https://api.kie.ai";

export interface Create4oImageParams {
  prompt?: string;
  filesUrl?: string[];
  size: "1:1" | "3:2" | "2:3";
  maskUrl?: string;
  callBackUrl?: string;
  isEnhance?: boolean;
}

export interface CreateFluxImageParams {
  prompt: string;
  inputImage?: string;
  aspectRatio?: "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  outputFormat?: "jpeg" | "png";
  model?: "flux-kontext-pro" | "flux-kontext-max";
  callBackUrl?: string;
  enableTranslation?: boolean;
}

export interface KieTaskRecord {
  taskId: string;
  model: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
}

export interface KieTaskResult {
  resultUrls?: string[];
  resultImageUrl?: string;
  /** Некоторые видео-модели отдают отдельное поле */
  resultVideoUrl?: string;
}

/** Ответ Kie API; при HTTP 429 code будет 429. */
export async function kieFetch(
  apiKey: string,
  path: string,
  options: { method: "GET" } | { method: "POST"; body: Record<string, unknown> }
): Promise<{ code: number; msg?: string; data?: unknown }> {
  const url = `${KIE_BASE}${path}`;
  const res = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    ...(options.method === "POST" && { body: JSON.stringify(options.body) }),
  });
  const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string; data?: unknown };
  const code = res.status === 429 ? 429 : (json.code ?? (res.ok ? 200 : res.status));
  return {
    code,
    msg: json.msg,
    data: json.data,
  };
}

/** Сообщение для пользователя при лимите запросов Kie (429). */
export const KIE_RATE_LIMIT_MESSAGE =
  "Слишком много запросов к сервису генерации. Задача поставлена в очередь, результат придёт позже.";

export type CreateKieTaskResult = { taskId: string } | { error: string; rateLimit?: boolean };

/**
 * Создать задачу генерации 4o Image.
 * Возвращает taskId при code 200; при 429 — error с rateLimit: true.
 */
export async function create4oImageTask(
  apiKey: string,
  params: Create4oImageParams
): Promise<CreateKieTaskResult> {
  const body: Record<string, unknown> = {
    size: params.size,
  };
  if (params.prompt) body.prompt = params.prompt;
  if (params.filesUrl?.length) body.filesUrl = params.filesUrl;
  if (params.maskUrl) body.maskUrl = params.maskUrl;
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;
  if (params.isEnhance != null) body.isEnhance = params.isEnhance;

  const out = await kieFetch(apiKey, "/api/v1/gpt4o-image/generate", { method: "POST", body });
  if (out.code === 429) {
    return { error: (out.msg as string) || "Rate limit", rateLimit: true };
  }
  if (out.code !== 200 || !out.data || typeof out.data !== "object") {
    return { error: (out.msg as string) || "Ошибка Kie 4o Image" };
  }
  const taskId = (out.data as { taskId?: string }).taskId;
  if (!taskId) return { error: "Нет taskId в ответе Kie" };
  return { taskId };
}

/**
 * Создать задачу генерации/редактирования Flux Kontext.
 */
export async function createFluxImageTask(
  apiKey: string,
  params: CreateFluxImageParams
): Promise<CreateKieTaskResult> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    enableTranslation: params.enableTranslation ?? true,
  };
  if (params.inputImage) body.inputImage = params.inputImage;
  if (params.aspectRatio) body.aspectRatio = params.aspectRatio;
  if (params.outputFormat) body.outputFormat = params.outputFormat;
  if (params.model) body.model = params.model;
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;

  const out = await kieFetch(apiKey, "/api/v1/flux/kontext/generate", { method: "POST", body });
  if (out.code === 429) {
    return { error: (out.msg as string) || "Rate limit", rateLimit: true };
  }
  if (out.code !== 200 || !out.data || typeof out.data !== "object") {
    return { error: (out.msg as string) || "Ошибка Kie Flux Kontext" };
  }
  const taskId = (out.data as { taskId?: string }).taskId;
  if (!taskId) return { error: "Нет taskId в ответе Kie" };
  return { taskId };
}

/**
 * Создать задачу через Kie Market API (единый endpoint для моделей nano-banana, qwen, gpt-image, flux-2 и др.).
 * POST /api/v1/jobs/createTask, body: { model, callBackUrl?, input }.
 */
export async function createMarketTask(
  apiKey: string,
  params: { model: string; input: Record<string, unknown>; callBackUrl?: string }
): Promise<CreateKieTaskResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    input: params.input,
  };
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl;

  const out = await kieFetch(apiKey, "/api/v1/jobs/createTask", { method: "POST", body });
  if (out.code === 429) {
    return { error: (out.msg as string) || "Rate limit", rateLimit: true };
  }
  if (out.code !== 200 || !out.data || typeof out.data !== "object") {
    return { error: (out.msg as string) || "Ошибка Kie Market API" };
  }
  const taskId = (out.data as { taskId?: string }).taskId;
  if (!taskId) return { error: "Нет taskId в ответе Kie" };
  return { taskId };
}

/**
 * Получить статус и результат задачи (единый endpoint для всех моделей Kie).
 */
export async function getKieTaskRecord(
  apiKey: string,
  taskId: string
): Promise<KieTaskRecord | null> {
  const out = await kieFetch(apiKey, `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" });
  if (out.code !== 200 || !out.data || typeof out.data !== "object") return null;
  const d = out.data as Record<string, unknown>;
  return {
    taskId: String(d.taskId ?? taskId),
    model: String(d.model ?? ""),
    state: (d.state as KieTaskRecord["state"]) ?? "waiting",
    resultJson: typeof d.resultJson === "string" ? d.resultJson : undefined,
    failCode: typeof d.failCode === "string" ? d.failCode : undefined,
    failMsg: typeof d.failMsg === "string" ? d.failMsg : undefined,
  };
}

export function parseKieResultJson(resultJson: string | undefined): KieTaskResult {
  if (!resultJson || typeof resultJson !== "string") return {};
  try {
    const parsed = JSON.parse(resultJson) as Record<string, unknown>;
    const resultUrls = parsed.resultUrls as string[] | undefined;
    const resultImageUrl = parsed.resultImageUrl as string | undefined;
    const resultVideoUrl =
      (parsed.resultVideoUrl as string | undefined) ||
      (parsed.result_video_url as string | undefined) ||
      (parsed.videoUrl as string | undefined);
    if (Array.isArray(resultUrls) && resultUrls.length > 0) {
      return { resultUrls, ...(resultVideoUrl ? { resultVideoUrl } : {}) };
    }
    if (typeof resultImageUrl === "string") {
      return { resultImageUrl };
    }
    if (typeof resultVideoUrl === "string") {
      return { resultVideoUrl };
    }
  } catch {
    // ignore
  }
  return {};
}

/** Первый URL результата: изображение или видео (Kie callback / recordInfo). */
export function firstMediaUrlFromKieTaskResult(parsed: KieTaskResult): string | null {
  if (parsed.resultUrls?.[0]) return parsed.resultUrls[0];
  if (parsed.resultVideoUrl) return parsed.resultVideoUrl;
  if (parsed.resultImageUrl) return parsed.resultImageUrl;
  return null;
}
