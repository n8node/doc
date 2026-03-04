export interface DoclingExtractRequest {
  fileId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  outputFormat?: "markdown" | "text" | "json";
}

export interface DoclingExtractResponse {
  filename: string;
  content_hash: string;
  text: string;
  tables: Array<{
    index: number;
    content: string;
  }>;
  num_pages: number | null;
  format: string;
}

export interface DoclingHealthResponse {
  status: string;
  service: string;
}

export interface DoclingFormatsResponse {
  formats: string[];
  ocr_languages: string[];
}

export type ProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface DocumentProcessingResult {
  fileId: string;
  text: string;
  tables: Array<{ index: number; content: string }>;
  contentHash: string;
  numPages: number | null;
  processedAt: Date;
}
