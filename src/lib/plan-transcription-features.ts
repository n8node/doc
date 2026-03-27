/**
 * Флаги тарифа: transcription_audio / transcription_video.
 * Legacy: если задан только features.transcription — как раньше (оба вида при true).
 */

export function hasTranscriptionAudio(
  features: Record<string, boolean> | null | undefined,
): boolean {
  const f = features ?? {};
  if (f.transcription_audio === true) return true;
  if (f.transcription_audio === false) return false;
  return f.transcription === true;
}

export function hasTranscriptionVideo(
  features: Record<string, boolean> | null | undefined,
): boolean {
  const f = features ?? {};
  if (f.transcription_video === true) return true;
  if (f.transcription_video === false) return false;
  return f.transcription === true;
}
