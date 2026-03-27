/**
 * Оценка времени транскрибации аудио (Whisper Turbo).
 * Коэффициент ~0.5 основан на бенчмарках: обработка занимает
 * примерно половину длительности аудио на типичном CPU/GPU.
 */
const PROCESSING_RATIO =
  parseFloat(process.env.TRANSCRIPTION_PROCESSING_RATIO || "0.5") || 0.5;

export interface TranscriptionTimeEstimate {
  /** Оценочное время обработки в секундах */
  estimatedProcessingSeconds: number;
  /** Оценочное время обработки в минутах (округлено вверх) */
  estimatedProcessingMinutes: number;
  /** Длительность аудио в секундах */
  audioDurationSeconds: number;
  /** Источник оценки */
  source: "metadata" | "file-size-fallback";
}

const CHUNK_SECONDS = 8 * 60;

/**
 * Вычисляет приблизительное время транскрибации по длительности аудио.
 * @param audioDurationSeconds — длительность аудио в секундах
 * @param source — откуда взята длительность (metadata или fallback по размеру)
 */
export function estimateTranscriptionTime(
  audioDurationSeconds: number,
  source: "metadata" | "file-size-fallback" = "metadata",
  options?: { isVideo?: boolean; cloudProvider?: boolean },
): TranscriptionTimeEstimate {
  const sec = Math.max(0, Math.round(audioDurationSeconds));
  let estimatedSec = Math.max(1, Math.ceil(sec * PROCESSING_RATIO));
  if (options?.isVideo) {
    estimatedSec += 45;
  }
  if (options?.cloudProvider) {
    const chunks = Math.max(1, Math.ceil(sec / CHUNK_SECONDS));
    if (chunks > 1) {
      estimatedSec += (chunks - 1) * 15;
    }
  }
  const estimatedMin = Math.max(1, Math.ceil(estimatedSec / 60));

  return {
    estimatedProcessingSeconds: estimatedSec,
    estimatedProcessingMinutes: estimatedMin,
    audioDurationSeconds: sec,
    source,
  };
}
