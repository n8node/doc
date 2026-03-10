/**
 * Embedding configuration: chunking, dimensions, search params.
 * Collection config overrides user config overrides defaults.
 */

export const DEFAULT_CHUNK_SIZE = 500;
export const DEFAULT_CHUNK_OVERLAP = 50;
export const DEFAULT_SIMILARITY_THRESHOLD = 0.5;
export const DEFAULT_TOP_K = 10;

export type ChunkStrategy = "paragraphs" | "sentences" | "fixed";

export interface EmbeddingConfigInput {
  chunkSize?: number;
  chunkOverlap?: number;
  chunkStrategy?: ChunkStrategy;
  dimensions?: number | null;
  similarityThreshold?: number;
  topK?: number;
}

export interface ResolvedEmbeddingConfig {
  chunkSize: number;
  chunkOverlap: number;
  chunkStrategy: ChunkStrategy;
  dimensions: number | null;
  similarityThreshold: number;
  topK: number;
}

const DEFAULT_CONFIG: ResolvedEmbeddingConfig = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  chunkOverlap: DEFAULT_CHUNK_OVERLAP,
  chunkStrategy: "paragraphs",
  dimensions: null,
  similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
  topK: DEFAULT_TOP_K,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseConfig(raw: unknown): EmbeddingConfigInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const result: EmbeddingConfigInput = {};
  if (typeof o.chunkSize === "number") result.chunkSize = clamp(o.chunkSize, 100, 2000);
  if (typeof o.chunkOverlap === "number") result.chunkOverlap = clamp(o.chunkOverlap, 0, 200);
  if (o.chunkStrategy === "paragraphs" || o.chunkStrategy === "sentences" || o.chunkStrategy === "fixed") {
    result.chunkStrategy = o.chunkStrategy;
  }
  if (o.dimensions === null) result.dimensions = null;
  else if (typeof o.dimensions === "number") result.dimensions = clamp(o.dimensions, 256, 3072);
  if (typeof o.similarityThreshold === "number") {
    result.similarityThreshold = clamp(o.similarityThreshold, 0.3, 0.95);
  }
  if (typeof o.topK === "number") result.topK = clamp(o.topK, 1, 50);
  return Object.keys(result).length > 0 ? result : null;
}

function mergeInput(base: ResolvedEmbeddingConfig, input: EmbeddingConfigInput): ResolvedEmbeddingConfig {
  return {
    chunkSize: input.chunkSize ?? base.chunkSize,
    chunkOverlap: input.chunkOverlap ?? base.chunkOverlap,
    chunkStrategy: input.chunkStrategy ?? base.chunkStrategy,
    dimensions: input.dimensions !== undefined ? input.dimensions : base.dimensions,
    similarityThreshold: input.similarityThreshold ?? base.similarityThreshold,
    topK: input.topK ?? base.topK,
  };
}

/**
 * Merge embedding config: collection overrides user overrides defaults.
 */
export function resolveEmbeddingConfig(
  collectionConfig: unknown,
  userConfig: unknown
): ResolvedEmbeddingConfig {
  let resolved = { ...DEFAULT_CONFIG };
  const userParsed = parseConfig(userConfig);
  if (userParsed) resolved = mergeInput(resolved, userParsed);
  const collParsed = parseConfig(collectionConfig);
  if (collParsed) resolved = mergeInput(resolved, collParsed);
  return resolved;
}

/**
 * Resolve from user config only (e.g. single-file processing without collection).
 */
export function resolveEmbeddingConfigFromUser(userConfig: unknown): ResolvedEmbeddingConfig {
  let resolved = { ...DEFAULT_CONFIG };
  const userParsed = parseConfig(userConfig);
  if (userParsed) resolved = mergeInput(resolved, userParsed);
  return resolved;
}

/**
 * Build embedding options for provider from resolved config (e.g. dimensions).
 */
export function toEmbeddingOptions(config: ResolvedEmbeddingConfig): { dimensions?: number } | undefined {
  if (config.dimensions != null && config.dimensions > 0) {
    return { dimensions: config.dimensions };
  }
  return undefined;
}

