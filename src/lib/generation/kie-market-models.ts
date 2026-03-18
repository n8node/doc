/**
 * Маппинг наших modelId на Kie Market API: model + построение input из body и fileUrls.
 * Документация: https://kieai.mintlify.app/market/
 */

export const KIE_MARKET_MODEL_IDS = new Set<string>([
  "kie-nano-banana-pro",
  "kie-nano-banana-2",
  "kie-nano-banana",
  "kie-nano-banana-edit",
  "kie-qwen-text-to-image",
  "kie-qwen-image-to-image",
  "kie-qwen-image-edit",
  "kie-qwen2-text-to-image",
  "kie-qwen2-image-edit",
  "kie-gpt-image-15-text",
  "kie-gpt-image-15-image",
  "kie-flux2-pro-image",
  "kie-flux2-pro-text",
  "kie-flux2-flex-image",
  "kie-flux2-flex-text",
]);

const KIE_MODEL_BY_ID: Record<string, string> = {
  "kie-nano-banana-pro": "nano-banana-pro",
  "kie-nano-banana-2": "nano-banana-2",
  "kie-nano-banana": "google/nano-banana",
  "kie-nano-banana-edit": "google/nano-banana-edit",
  "kie-qwen-text-to-image": "qwen/text-to-image",
  "kie-qwen-image-to-image": "qwen/image-to-image",
  "kie-qwen-image-edit": "qwen/image-edit",
  "kie-qwen2-text-to-image": "qwen2/text-to-image",
  "kie-qwen2-image-edit": "qwen2/image-edit",
  "kie-gpt-image-15-text": "gpt-image/1.5-text-to-image",
  "kie-gpt-image-15-image": "gpt-image/1.5-image-to-image",
  "kie-flux2-pro-image": "flux-2/pro-image-to-image",
  "kie-flux2-pro-text": "flux-2/pro-text-to-image",
  "kie-flux2-flex-image": "flux-2/flex-image-to-image",
  "kie-flux2-flex-text": "flux-2/flex-text-to-image",
};

export function isMarketModel(modelId: string): boolean {
  return KIE_MARKET_MODEL_IDS.has(modelId);
}

export function getKieModelForMarket(modelId: string): string | null {
  return KIE_MODEL_BY_ID[modelId] ?? null;
}

type BuildInputParams = {
  modelId: string;
  taskType: string;
  prompt: string;
  fileUrls: string[];
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: string;
  size?: string;
  quality?: string;
  strength?: number;
  negativePrompt?: string;
  seed?: number;
  numImages?: number;
  acceleration?: string;
};

/**
 * Строит объект input для POST /api/v1/jobs/createTask по нашей modelId и параметрам.
 */
export function buildMarketInput(params: BuildInputParams): Record<string, unknown> | { error: string } {
  const { modelId, prompt, fileUrls, aspectRatio, resolution, outputFormat, size, quality, strength, negativePrompt, seed, numImages, acceleration } = params;
  const aspect = aspectRatio ?? "1:1";
  const res = resolution ?? "1K";
  const format = outputFormat === "jpeg" || outputFormat === "jpg" ? "jpg" : "png";
  const acc = acceleration === "regular" || acceleration === "high" ? acceleration : "none";

  switch (modelId) {
    case "kie-nano-banana-pro":
      return {
        prompt: prompt || " ",
        image_input: fileUrls.slice(0, 8),
        aspect_ratio: aspect,
        resolution: res === "4K" ? "4K" : res === "2K" ? "2K" : "1K",
        output_format: format,
      };
    case "kie-nano-banana-2":
      return {
        prompt: prompt || " ",
        image_input: fileUrls.slice(0, 14),
        aspect_ratio: aspect === "auto" ? "auto" : aspect,
        resolution: res === "4K" ? "4K" : res === "2K" ? "2K" : "1K",
        output_format: format,
      };
    case "kie-nano-banana":
      return {
        prompt: prompt || " ",
        image_size: size ?? "1:1",
        output_format: format === "jpg" ? "jpeg" : "png",
      };
    case "kie-nano-banana-edit":
      if (!fileUrls.length) return { error: "Для редактирования нужно загрузить изображение" };
      return {
        prompt: prompt || " ",
        image_urls: fileUrls.slice(0, 10),
        image_size: size ?? "1:1",
        output_format: format === "jpg" ? "jpeg" : "png",
      };
    case "kie-qwen-text-to-image":
      return {
        prompt: prompt || " ",
        image_size: mapAspectToQwenSize(aspect),
        output_format: format === "jpg" ? "jpeg" : "png",
      };
    case "kie-qwen-image-to-image":
      if (!fileUrls[0]) return { error: "Нужно загрузить исходное изображение" };
      const qwenI2i: Record<string, unknown> = {
        prompt: prompt || " ",
        image_url: fileUrls[0],
        output_format: format === "jpg" ? "jpeg" : "png",
      };
      if (strength != null && Number.isFinite(strength)) qwenI2i.strength = strength;
      if (negativePrompt != null && String(negativePrompt).trim()) qwenI2i.negative_prompt = String(negativePrompt).trim();
      if (seed != null && Number.isFinite(seed)) qwenI2i.seed = seed;
      if (acc) qwenI2i.acceleration = acc;
      return qwenI2i;
    case "kie-qwen-image-edit":
      if (!fileUrls[0]) return { error: "Для редактирования нужно загрузить изображение" };
      const qwenEdit: Record<string, unknown> = {
        prompt: prompt || " ",
        image_url: fileUrls[0],
        image_size: mapAspectToQwenImageEditSize(aspect),
        output_format: format === "jpg" ? "jpeg" : "png",
      };
      if (numImages != null && numImages >= 1 && numImages <= 4) qwenEdit.num_images = String(numImages);
      if (seed != null && Number.isFinite(seed)) qwenEdit.seed = seed;
      if (negativePrompt != null && String(negativePrompt).trim()) qwenEdit.negative_prompt = String(negativePrompt).trim();
      if (acc) qwenEdit.acceleration = acc;
      return qwenEdit;
    case "kie-qwen2-text-to-image": {
      const q2t: Record<string, unknown> = {
        prompt: prompt || " ",
        image_size: mapAspectToQwen2TextSize(aspect),
        output_format: format === "jpg" ? "jpeg" : "png",
      };
      if (seed != null && Number.isFinite(seed)) q2t.seed = seed;
      return q2t;
    }
    case "kie-qwen2-image-edit": {
      if (!fileUrls.length) return { error: "Для редактирования нужно загрузить изображение" };
      const q2e: Record<string, unknown> = {
        prompt: prompt || " ",
        image_url: fileUrls.slice(0, 3),
        image_size: mapAspectToQwen2EditSize(aspect),
        output_format: format === "jpg" ? "jpeg" : "png",
      };
      if (seed != null && Number.isFinite(seed)) q2e.seed = seed;
      return q2e;
    }
    case "kie-gpt-image-15-text":
      return {
        prompt: prompt || " ",
        aspect_ratio: mapAspectToGpt(aspect),
        quality: quality === "high" ? "high" : "medium",
      };
    case "kie-gpt-image-15-image":
      if (!fileUrls.length) return { error: "Нужно загрузить изображение" };
      return {
        input_urls: fileUrls.slice(0, 16),
        prompt: prompt || " ",
        aspect_ratio: mapAspectToGpt(aspect),
        quality: quality === "high" ? "high" : "medium",
      };
    case "kie-flux2-pro-image":
    case "kie-flux2-flex-image":
      if (!fileUrls.length) return { error: "Нужно загрузить изображение" };
      return {
        input_urls: fileUrls.slice(0, 8),
        prompt: prompt || " ",
        aspect_ratio: aspect,
        resolution: res === "2K" ? "2K" : "1K",
      };
    case "kie-flux2-pro-text":
    case "kie-flux2-flex-text":
      return {
        prompt: prompt || " ",
        aspect_ratio: aspect,
        resolution: res === "2K" ? "2K" : "1K",
      };
    default:
      return { error: "Неизвестная модель" };
  }
}

function mapAspectToQwenSize(aspect: string): string {
  const m: Record<string, string> = {
    "1:1": "square_hd",
    "3:4": "portrait_4_3",
    "4:3": "landscape_4_3",
    "9:16": "portrait_16_9",
    "16:9": "landscape_16_9",
  };
  return m[aspect] ?? "square_hd";
}

/** qwen/image-edit: image_size = square | square_hd | portrait_4_3 | portrait_16_9 | landscape_4_3 | landscape_16_9 */
function mapAspectToQwenImageEditSize(aspect: string): string {
  return mapAspectToQwenSize(aspect);
}

/** qwen2/text-to-image: image_size = 1:1 | 4:3 | 3:4 | 16:9 | 9:16 */
function mapAspectToQwen2TextSize(aspect: string): string {
  const allowed = new Set(["1:1", "4:3", "3:4", "16:9", "9:16"]);
  return allowed.has(aspect) ? aspect : "1:1";
}

/** qwen2/image-edit: image_size = 1:1 | 2:3 | 3:2 | 3:4 | 4:3 | 9:16 | 16:9 | 21:9 */
function mapAspectToQwen2EditSize(aspect: string): string {
  const allowed = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"]);
  return allowed.has(aspect) ? aspect : "1:1";
}

function mapAspectToGpt(aspect: string): "1:1" | "2:3" | "3:2" {
  if (aspect === "2:3" || aspect === "3:2") return aspect;
  return "1:1";
}
