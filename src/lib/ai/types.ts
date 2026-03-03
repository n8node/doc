export interface AiProviderConfig {
  type: "CLOUD" | "SELF_HOSTED" | "LOCAL";
  baseUrl?: string;
  apiKey?: string;
  modelName: string;
  folderId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiEmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
}

export interface AiAnalysisResult {
  summary?: string;
  categories?: string[];
  entities?: Array<{ name: string; type: string; confidence: number }>;
  language?: string;
  raw?: unknown;
}
