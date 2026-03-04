import type {
  DoclingExtractResponse,
  DoclingHealthResponse,
  DoclingFormatsResponse,
} from "./types";

const DOCLING_URL = process.env.DOCLING_URL || "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 300_000; // 5 min for large documents

class DoclingClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || DOCLING_URL;
  }

  async health(): Promise<DoclingHealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Docling health check failed: ${res.status}`);
    return res.json();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const h = await this.health();
      return h.status === "ok";
    } catch {
      return false;
    }
  }

  async extractFromBuffer(
    buffer: Buffer,
    filename: string,
    outputFormat: "markdown" | "text" | "json" = "markdown",
  ): Promise<DoclingExtractResponse> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)]);
    form.append("file", blob, filename);

    const url = `${this.baseUrl}/extract?output_format=${outputFormat}`;
    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Docling extract failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  async supportedFormats(): Promise<DoclingFormatsResponse> {
    const res = await fetch(`${this.baseUrl}/formats`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) throw new Error(`Docling formats request failed: ${res.status}`);
    return res.json();
  }
}

let _client: DoclingClient | null = null;

export function getDoclingClient(): DoclingClient {
  if (!_client) {
    _client = new DoclingClient();
  }
  return _client;
}

export { DoclingClient };
