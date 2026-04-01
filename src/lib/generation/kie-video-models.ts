/**
 * Kie Market: видео-модели Kling 3.0
 * Документация: https://docs.kie.ai/market/kling/kling-3-0 , motion-control-v3
 */

export const KIE_KLING_VIDEO_MODEL = "kling-3.0/video";
export const KIE_KLING_MOTION_MODEL = "kling-3.0/motion-control";

export const OUR_VIDEO_MODEL_IDS = new Set(["kie-kling-30-video", "kie-kling-30-motion"]);

export function getKieVideoMarketModel(ourModelId: string): string | null {
  if (ourModelId === "kie-kling-30-video") return KIE_KLING_VIDEO_MODEL;
  if (ourModelId === "kie-kling-30-motion") return KIE_KLING_MOTION_MODEL;
  return null;
}

export type Kling30VideoInputParams = {
  prompt: string;
  durationSec: number;
  mode: "std" | "pro";
  sound: boolean;
  aspectRatio: "16:9" | "9:16" | "1:1";
  multiShots: boolean;
  imageUrls: string[];
  multiPrompt: Array<{ prompt: string; duration: number }>;
};

export function buildKling30VideoInput(params: Kling30VideoInputParams): Record<string, unknown> {
  const d = String(Math.min(15, Math.max(3, Math.round(params.durationSec))));
  const input: Record<string, unknown> = {
    prompt: params.prompt,
    sound: params.sound,
    duration: d,
    mode: params.mode,
    multi_shots: params.multiShots,
    multi_prompt: params.multiPrompt,
  };
  if (params.imageUrls.length > 0) {
    input.image_urls = params.imageUrls;
  } else {
    input.aspect_ratio = params.aspectRatio;
  }
  return input;
}

export type Kling30MotionInputParams = {
  prompt?: string;
  inputUrls: string[];
  videoUrls: string[];
  mode: "720p" | "1080p";
  characterOrientation: "image" | "video";
  backgroundSource?: "input_video" | "input_image";
};

export function buildKling30MotionInput(params: Kling30MotionInputParams): Record<string, unknown> {
  const input: Record<string, unknown> = {
    input_urls: params.inputUrls,
    video_urls: params.videoUrls,
    mode: params.mode,
    character_orientation: params.characterOrientation,
  };
  if (params.prompt?.trim()) input.prompt = params.prompt.trim();
  if (params.backgroundSource) input.background_source = params.backgroundSource;
  return input;
}
