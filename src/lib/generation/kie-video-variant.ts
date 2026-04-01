/**
 * Составной variant для kie_pricing: качество (mode) + длительность + звук (Kling 3.0 video)
 * или разрешение + ориентация (motion control).
 */
export function buildKling30VideoPricingVariant(params: {
  mode: "std" | "pro";
  durationSec: number;
  sound: boolean;
}): string {
  const d = Math.min(15, Math.max(3, Math.round(params.durationSec)));
  return `${params.mode}|d${d}|snd${params.sound ? 1 : 0}`;
}

export function buildKling30MotionPricingVariant(params: {
  mode: "720p" | "1080p";
  characterOrientation: "image" | "video";
}): string {
  return `${params.mode}|${params.characterOrientation}`;
}
