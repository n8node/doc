/**
 * OpenAI Whisper API client for audio transcription.
 * POST /v1/audio/transcriptions
 * https://platform.openai.com/docs/api-reference/audio/createTranscription
 */

const OPENAI_WHISPER_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const MIME_TO_EXT: Record<string, string> = {
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export interface OpenAiWhisperResult {
  text: string;
  contentHash: string;
  format: string;
}

export async function transcribeWithOpenAiWhisper(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  apiKey: string,
  baseUrl: string = "https://api.openai.com/v1",
  model: string = "whisper-1",
): Promise<OpenAiWhisperResult> {
  if (buffer.length > OPENAI_WHISPER_MAX_FILE_SIZE) {
    throw new Error(
      `Файл слишком большой для OpenAI Whisper (макс. 25 МБ). Размер: ${(buffer.length / 1024 / 1024).toFixed(1)} МБ`,
    );
  }

  const ext = MIME_TO_EXT[mimeType] || filename.split(".").pop() || "mp3";
  const safeName = filename || `audio.${ext}`;

  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  form.append("file", blob, safeName);
  form.append("model", model);
  form.append("response_format", "text"); // simple text for compatibility with Docling format

  const url = `${baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
    signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min timeout
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    let errMsg = `OpenAI Whisper failed (${res.status}): ${errBody}`;
    if (res.status === 401) errMsg = "Неверный API ключ OpenAI";
    if (res.status === 429) errMsg = "Превышен лимит запросов OpenAI. Попробуйте позже.";
    if (res.status === 413) errMsg = "Файл слишком большой для OpenAI Whisper (макс. 25 МБ)";
    throw new Error(errMsg);
  }

  const text = await res.text();
  const crypto = await import("crypto");
  const contentHash = crypto.createHash("sha256").update(text).digest("hex");

  return {
    text: text.trim(),
    contentHash,
    format: ext,
  };
}
