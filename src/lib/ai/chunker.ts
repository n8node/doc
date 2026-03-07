const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/** Email pattern (simple). */
const EMAIL_RE = /\b[\w.-]+@[\w.-]+\.\w{2,}\b/g;
/** Phone pattern: +7, 8, digits with spaces/dashes. */
const PHONE_RE = /[\d\s\-+()]{10,}/g;

/**
 * Chunk is "noise" if >50% of non-whitespace chars are emails or phone-like sequences.
 * Such chunks (e.g. from Excel contact tables) produce poor search results.
 */
export function isNoiseChunk(text: string): boolean {
  if (!text || text.trim().length < 50) return false;
  const trimmed = text.replace(/\s+/g, "");
  if (trimmed.length < 30) return false;
  let noiseLength = 0;
  let m: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(text)) !== null) noiseLength += m[0].replace(/\s/g, "").length;
  PHONE_RE.lastIndex = 0;
  while ((m = PHONE_RE.exec(text)) !== null) noiseLength += m[0].replace(/\s/g, "").length;
  return noiseLength / trimmed.length > 0.5;
}

export interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
}

export function chunkText(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  overlap = DEFAULT_OVERLAP,
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const cleaned = text.replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= chunkSize) {
    return [{ text: cleaned, index: 0, startChar: 0, endChar: cleaned.length }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;
  let idx = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const window = cleaned.slice(Math.max(end - 80, start), end);
      const lastParagraph = window.lastIndexOf("\n\n");
      const lastSentence = window.search(/[.!?]\s+[A-ZА-ЯЁ]/);
      const lastSpace = window.lastIndexOf(" ");

      if (lastParagraph > 0) {
        end = Math.max(end - 80, start) + lastParagraph + 2;
      } else if (lastSentence > 0) {
        end = Math.max(end - 80, start) + lastSentence + 1;
      } else if (lastSpace > 0) {
        end = Math.max(end - 80, start) + lastSpace + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push({ text: chunk, index: idx, startChar: start, endChar: end });
      idx++;
    }

    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}
