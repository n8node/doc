/**
 * Конфиг полей интерфейса по modelId: какие показывать и какие варианты.
 * Используется на странице /dashboard/generate/image.
 */

export type AspectOption = { value: string; label: string };

const COMMON_ASPECT: AspectOption[] = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "21:9", label: "21:9" },
];

export const MODEL_FIELDS_CONFIG: Record<
  string,
  {
    aspectOptions?: AspectOption[];
    sizeOptions?: AspectOption[];
    showResolution?: boolean;
    showQuality?: boolean;
    showOutputFormat?: boolean;
    showStrength?: boolean;
    showNegativePrompt?: boolean;
    showSeed?: boolean;
    showNumImages?: boolean;
    showAcceleration?: boolean;
    showFluxModel?: boolean;
  }
> = {
  "kie-4o-image": {
    sizeOptions: [
      { value: "1:1", label: "1:1" },
      { value: "3:2", label: "3:2" },
      { value: "2:3", label: "2:3" },
    ],
    showOutputFormat: true,
  },
  "kie-flux-kontext": {
    aspectOptions: [
      { value: "21:9", label: "21:9" },
      { value: "16:9", label: "16:9" },
      { value: "4:3", label: "4:3" },
      { value: "1:1", label: "1:1" },
      { value: "3:4", label: "3:4" },
      { value: "9:16", label: "9:16" },
    ],
    showOutputFormat: true,
    showFluxModel: true,
  },
  "kie-nano-banana-pro": {
    aspectOptions: [...COMMON_ASPECT],
    showResolution: true,
    showOutputFormat: true,
  },
  "kie-nano-banana-2": {
    aspectOptions: [
      ...COMMON_ASPECT,
      { value: "auto", label: "Auto" },
    ],
    showResolution: true,
    showOutputFormat: true,
  },
  "kie-nano-banana": {
    sizeOptions: [
      { value: "1:1", label: "1:1" },
      { value: "9:16", label: "9:16" },
      { value: "16:9", label: "16:9" },
      { value: "3:4", label: "3:4" },
      { value: "4:3", label: "4:3" },
      { value: "3:2", label: "3:2" },
      { value: "2:3", label: "2:3" },
      { value: "5:4", label: "5:4" },
      { value: "4:5", label: "4:5" },
      { value: "21:9", label: "21:9" },
      { value: "auto", label: "Auto" },
    ],
    showOutputFormat: true,
  },
  "kie-nano-banana-edit": {
    sizeOptions: [
      { value: "1:1", label: "1:1" },
      { value: "9:16", label: "9:16" },
      { value: "16:9", label: "16:9" },
      { value: "3:4", label: "3:4" },
      { value: "4:3", label: "4:3" },
      { value: "3:2", label: "3:2" },
      { value: "2:3", label: "2:3" },
      { value: "5:4", label: "5:4" },
      { value: "4:5", label: "4:5" },
      { value: "21:9", label: "21:9" },
      { value: "auto", label: "Auto" },
    ],
    showOutputFormat: true,
  },
  "kie-qwen-text-to-image": {
    aspectOptions: [
      { value: "1:1", label: "1:1" },
      { value: "4:3", label: "4:3" },
      { value: "3:4", label: "3:4" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    showOutputFormat: true,
  },
  "kie-qwen-image-to-image": {
    aspectOptions: COMMON_ASPECT,
    showOutputFormat: true,
    showStrength: true,
    showNegativePrompt: true,
    showSeed: true,
    showAcceleration: true,
  },
  "kie-qwen-image-edit": {
    aspectOptions: [
      { value: "1:1", label: "1:1 (Square)" },
      { value: "4:3", label: "4:3 (Landscape)" },
      { value: "3:4", label: "3:4 (Portrait)" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    showOutputFormat: true,
    showNumImages: true,
    showSeed: true,
    showAcceleration: true,
    showNegativePrompt: true,
  },
  "kie-qwen2-text-to-image": {
    aspectOptions: [
      { value: "1:1", label: "1:1" },
      { value: "4:3", label: "4:3" },
      { value: "3:4", label: "3:4" },
      { value: "16:9", label: "16:9" },
      { value: "9:16", label: "9:16" },
    ],
    showOutputFormat: true,
    showSeed: true,
  },
  "kie-qwen2-image-edit": {
    aspectOptions: [
      { value: "1:1", label: "1:1" },
      { value: "2:3", label: "2:3" },
      { value: "3:2", label: "3:2" },
      { value: "3:4", label: "3:4" },
      { value: "4:3", label: "4:3" },
      { value: "9:16", label: "9:16" },
      { value: "16:9", label: "16:9" },
      { value: "21:9", label: "21:9" },
    ],
    showOutputFormat: true,
    showSeed: true,
  },
  "kie-gpt-image-15-text": {
    aspectOptions: [
      { value: "1:1", label: "1:1" },
      { value: "2:3", label: "2:3" },
      { value: "3:2", label: "3:2" },
    ],
    showQuality: true,
  },
  "kie-gpt-image-15-image": {
    aspectOptions: [
      { value: "1:1", label: "1:1" },
      { value: "2:3", label: "2:3" },
      { value: "3:2", label: "3:2" },
    ],
    showQuality: true,
  },
  "kie-flux2-pro-text": {
    aspectOptions: [...COMMON_ASPECT],
    showResolution: true,
    showOutputFormat: true,
  },
  "kie-flux2-pro-image": {
    aspectOptions: [...COMMON_ASPECT],
    showResolution: true,
    showOutputFormat: true,
  },
  "kie-flux2-flex-text": {
    aspectOptions: [...COMMON_ASPECT],
    showResolution: true,
    showOutputFormat: true,
  },
  "kie-flux2-flex-image": {
    aspectOptions: [...COMMON_ASPECT],
    showResolution: true,
    showOutputFormat: true,
  },
};

export function getModelFieldsConfig(modelId: string) {
  return MODEL_FIELDS_CONFIG[modelId] ?? {};
}
