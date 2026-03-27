/**
 * Чистые функции для отображения квот транскрибации (клиент и сервер).
 * Логика «раздельного» режима совпадает с isSplitTranscriptionQuotaMode в transcription-quota.ts.
 */

import {
  hasTranscriptionAudio,
  hasTranscriptionVideo,
} from "@/lib/plan-transcription-features";

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

/** Строки для карточки тарифа — только аудио (месяц + лимит файла). */
export function getTranscriptionAudioDetailLines(plan: PlanTranscriptionPublic): string[] {
  const lines: string[] = [];
  if (!isSplitTranscriptionPlan(plan)) {
    const q = n(plan.transcriptionMinutesQuota);
    lines.push(
      q != null
        ? `${q} мин/мес — общая квота (аудио и видео вместе)`
        : "Безлимит минут в месяц (аудио и видео вместе)",
    );
  } else {
    const audioQ = n(plan.transcriptionAudioMinutesQuota) ?? n(plan.transcriptionMinutesQuota);
    lines.push(
      audioQ != null ? `Аудио: ${audioQ} мин/мес` : "Аудио: безлимит",
    );
  }
  const maxA = plan.maxTranscriptionAudioMinutes;
  if (maxA != null) lines.push(`Один файл: до ${maxA} мин`);
  return lines;
}

/** Строки для карточки тарифа — только видео. */
export function getTranscriptionVideoDetailLines(plan: PlanTranscriptionPublic): string[] {
  const lines: string[] = [];
  if (!isSplitTranscriptionPlan(plan)) {
    const q = n(plan.transcriptionMinutesQuota);
    lines.push(
      q != null
        ? `${q} мин/мес — общая квота (аудио и видео вместе)`
        : "Безлимит минут в месяц (аудио и видео вместе)",
    );
  } else {
    const videoQ = n(plan.transcriptionVideoMinutesQuota) ?? n(plan.transcriptionMinutesQuota);
    lines.push(
      videoQ != null ? `Видео: ${videoQ} мин/мес` : "Видео: безлимит",
    );
  }
  const maxV = plan.maxTranscriptionVideoMinutes;
  if (maxV != null) lines.push(`Один файл: до ${maxV} мин`);
  return lines;
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

/** Расход по аудио — если фича включена. */
export function formatTranscriptionAudioUsageLine(me: MeTranscriptionUsage): string | null {
  if (!hasTranscriptionAudio(me.features)) return null;
  const split =
    me.transcriptionAudioMinutesQuota != null || me.transcriptionVideoMinutesQuota != null;
  if (!split) {
    const q = me.transcriptionMinutesQuota;
    if (q == null) return "Транскрибация аудио: безлимит минут в месяц";
    const u = me.transcriptionMinutesUsedThisMonth ?? 0;
    return `Транскрибация аудио: ${u} / ${q} мин в этом месяце (общая квота с видео)`;
  }
  const aq = me.transcriptionAudioMinutesQuota ?? me.transcriptionMinutesQuota;
  if (aq == null) return "Транскрибация аудио: безлимит";
  const u = me.transcriptionAudioMinutesUsedThisMonth ?? 0;
  return `Транскрибация аудио: ${u} / ${aq} мин в этом месяце`;
}

/** Расход по видео — если фича включена. */
export function formatTranscriptionVideoUsageLine(me: MeTranscriptionUsage): string | null {
  if (!hasTranscriptionVideo(me.features)) return null;
  const split =
    me.transcriptionAudioMinutesQuota != null || me.transcriptionVideoMinutesQuota != null;
  if (!split) {
    const q = me.transcriptionMinutesQuota;
    if (q == null) return "Транскрибация видео: безлимит минут в месяц";
    const u = me.transcriptionMinutesUsedThisMonth ?? 0;
    return `Транскрибация видео: ${u} / ${q} мин в этом месяце (общая квота с аудио)`;
  }
  const vq = me.transcriptionVideoMinutesQuota ?? me.transcriptionMinutesQuota;
  if (vq == null) return "Транскрибация видео: безлимит";
  const u = me.transcriptionVideoMinutesUsedThisMonth ?? 0;
  return `Транскрибация видео: ${u} / ${vq} мин в этом месяце`;
}
