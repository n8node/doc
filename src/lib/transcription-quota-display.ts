/**
 * Чистые функции для отображения квот транскрибации (клиент и сервер).
 * Логика «раздельного» режима совпадает с isSplitTranscriptionQuotaMode в transcription-quota.ts.
 */

export type PlanTranscriptionPublic = {
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
  maxTranscriptionAudioMinutes?: number | null;
  maxTranscriptionVideoMinutes?: number | null;
};

export function isSplitTranscriptionPlan(plan: PlanTranscriptionPublic): boolean {
  return (
    plan.transcriptionAudioMinutesQuota != null || plan.transcriptionVideoMinutesQuota != null
  );
}

function n(v: number | null | undefined): number | null {
  return v === undefined ? null : v;
}

/** Строки подписи к квотам (месяц). */
export function getTranscriptionMonthlyQuotaLines(plan: PlanTranscriptionPublic): string[] {
  if (!isSplitTranscriptionPlan(plan)) {
    const q = n(plan.transcriptionMinutesQuota);
    if (q == null) return ["Безлимит минут в месяц (аудио и видео вместе)"];
    return [`${q} мин/мес — общая квота (аудио и видео вместе)`];
  }
  const audioQ = n(plan.transcriptionAudioMinutesQuota) ?? n(plan.transcriptionMinutesQuota);
  const videoQ = n(plan.transcriptionVideoMinutesQuota) ?? n(plan.transcriptionMinutesQuota);
  return [
    `Аудио: ${audioQ != null ? `${audioQ} мин/мес` : "безлимит"}`,
    `Видео: ${videoQ != null ? `${videoQ} мин/мес` : "безлимит"}`,
  ];
}

/** Лимит длительности одного файла (если заданы в плане). */
export function getTranscriptionPerFileLine(plan: PlanTranscriptionPublic): string | null {
  const a = plan.maxTranscriptionAudioMinutes;
  const v = plan.maxTranscriptionVideoMinutes;
  if (a == null && v == null) return null;
  const parts: string[] = [];
  if (a != null) parts.push(`аудио до ${a} мин за файл`);
  if (v != null) parts.push(`видео до ${v} мин за файл`);
  return `Один файл: ${parts.join("; ")}`;
}

export type MeTranscriptionUsage = {
  features?: Record<string, boolean>;
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
  transcriptionMinutesUsedThisMonth?: number;
  transcriptionAudioMinutesUsedThisMonth?: number;
  transcriptionVideoMinutesUsedThisMonth?: number;
};

/** Краткая строка расхода для блока «текущий тариф». */
export function formatTranscriptionUsageLine(me: MeTranscriptionUsage): string | null {
  if (!me.features?.transcription) return null;
  const split =
    me.transcriptionAudioMinutesQuota != null || me.transcriptionVideoMinutesQuota != null;
  if (!split) {
    const q = me.transcriptionMinutesQuota;
    if (q == null) return "Транскрибация: безлимит минут в месяц";
    const u = me.transcriptionMinutesUsedThisMonth ?? 0;
    return `Транскрибация: ${u} / ${q} мин в этом месяце (аудио и видео вместе)`;
  }
  const parts: string[] = [];
  const aq = me.transcriptionAudioMinutesQuota ?? me.transcriptionMinutesQuota;
  const vq = me.transcriptionVideoMinutesQuota ?? me.transcriptionMinutesQuota;
  if (aq != null) {
    const u = me.transcriptionAudioMinutesUsedThisMonth ?? 0;
    parts.push(`аудио ${u} / ${aq} мин`);
  }
  if (vq != null) {
    const u = me.transcriptionVideoMinutesUsedThisMonth ?? 0;
    parts.push(`видео ${u} / ${vq} мин`);
  }
  if (parts.length === 0) return "Транскрибация: безлимит";
  return `Транскрибация в этом месяце: ${parts.join("; ")}`;
}
