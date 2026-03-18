/**
 * OpenRouter transcription via chat completions with input_audio.
 * https://openrouter.ai/docs/guides/overview/multimodal/audio
 */

const OPENROUTER_AUDIO_MAX_SIZE = 25 * 1024 * 1024; // 25 MB

const MIME_TO_FORMAT: Record<string, string> = {
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

export interface OpenRouterTranscribeResult {
  text: string;
  contentHash: string;
  format: string;
}

export async function transcribeWithOpenRouter(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  apiKey: string,
  baseUrl: string = "https://openrouter.ai/api/v1",
  modelName: string = "google/gemini-2.0-flash-exp",
): Promise<OpenRouterTranscribeResult> {
  if (buffer.length > OPENROUTER_AUDIO_MAX_SIZE) {
    throw new Error(
      `Файл слишком большой для OpenRouter (макс. 25 МБ). Размер: ${(buffer.length / 1024 / 1024).toFixed(1)} МБ`,
    );
  }

  const format =
    MIME_TO_FORMAT[mimeType] || filename.split(".").pop()?.toLowerCase() || "mp3";
  const base64Audio = buffer.toString("base64");

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://qoqon.ru",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this audio file to text. Return only the raw transcript, no commentary or formatting.",
            },
            {
              type: "input_audio",
              input_audio: {
                data: base64Audio,
                format,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000), // 10 min
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    let errMsg = `OpenRouter transcription failed (${res.status}): ${errBody}`;
    if (res.status === 401) errMsg = "Неверный API ключ OpenRouter";
    if (res.status === 429) errMsg = "Превышен лимит запросов OpenRouter. Попробуйте позже.";
    throw new Error(errMsg);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (json.error?.message) {
    throw new Error(`OpenRouter: ${json.error.message}`);
  }
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  const crypto = await import("crypto");
  const contentHash = crypto.createHash("sha256").update(text).digest("hex");
  const ext = format || "txt";

  return {
    text,
    contentHash,
    format: ext,
  };
}
