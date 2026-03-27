import {
  getTranscriptionAudioMinutesUsedThisMonth,
  getTranscriptionMinutesUsedThisMonth,
  getTranscriptionVideoMinutesUsedThisMonth,
} from "./transcription-usage";

export type TranscriptionPlanQuotaFields = {
  transcriptionMinutesQuota: number | null;
  transcriptionAudioMinutesQuota: number | null;
  transcriptionVideoMinutesQuota: number | null;
};

/**
 * Режим «раздельных» квот: задано хотя бы одно из полей аудио/видео мин/мес.
 * Иначе — общий пул `transcriptionMinutesQuota` (суммарный учёт минут).
 */
export function isSplitTranscriptionQuotaMode(plan: TranscriptionPlanQuotaFields): boolean {
  return (
    plan.transcriptionAudioMinutesQuota != null || plan.transcriptionVideoMinutesQuota != null
  );
}

export async function getTranscriptionQuotaDenyReason(
  userId: string,
  plan: TranscriptionPlanQuotaFields,
  sourceKind: "audio" | "video",
  durationMinutes: number,
): Promise<{
  code: string;
  message: string;
  used?: number;
  quota?: number;
} | null> {
  if (isSplitTranscriptionQuotaMode(plan)) {
    if (sourceKind === "audio") {
      const quota =
        plan.transcriptionAudioMinutesQuota ?? plan.transcriptionMinutesQuota ?? null;
      if (quota == null) return null;
      const used = await getTranscriptionAudioMinutesUsedThisMonth(userId);
      if (used + durationMinutes > quota) {
        return {
          code: "TRANSCRIPTION_AUDIO_QUOTA_EXCEEDED",
          message:
            "Лимит минут транскрибации аудио по тарифу исчерпан. Обновите тариф или дождитесь следующего месяца.",
          used,
          quota,
        };
      }
      return null;
    }
    const quota = plan.transcriptionVideoMinutesQuota ?? plan.transcriptionMinutesQuota ?? null;
    if (quota == null) return null;
    const used = await getTranscriptionVideoMinutesUsedThisMonth(userId);
    if (used + durationMinutes > quota) {
      return {
        code: "TRANSCRIPTION_VIDEO_QUOTA_EXCEEDED",
        message:
          "Лимит минут транскрибации видео по тарифу исчерпан. Обновите тариф или дождитесь следующего месяца.",
        used,
        quota,
      };
    }
    return null;
  }

  const quota = plan.transcriptionMinutesQuota ?? null;
  if (quota == null) return null;
  const used = await getTranscriptionMinutesUsedThisMonth(userId);
  if (used + durationMinutes > quota) {
    return {
      code: "TRANSCRIPTION_QUOTA_EXCEEDED",
      message:
        "Лимит минут транскрибации по вашему тарифу исчерпан. Обновите тариф или дождитесь следующего месяца.",
      used,
      quota,
    };
  }
  return null;
}
