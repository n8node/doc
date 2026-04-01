import { prisma } from "@/lib/prisma";

const MIN_SEC = 1;
const MAX_SEC = 600;
const FALLBACK_SEC = 5;

/**
 * Длительность референс-видео (сек, округление вверх) для расчёта стоимости motion по ставке «кредитов/сек».
 * Берётся из mediaMetadata; при отсутствии — оценка по размеру файла (как в transcribe estimate).
 */
export async function getMotionReferenceDurationSec(videoFileId: string, userId: string): Promise<number> {
  const file = await prisma.file.findFirst({
    where: { id: videoFileId, userId, deletedAt: null },
    select: { mediaMetadata: true, size: true },
  });
  if (!file) return FALLBACK_SEC;

  const meta = file.mediaMetadata as { durationSeconds?: number } | null;
  let sec = meta?.durationSeconds;
  if (sec != null && Number.isFinite(sec) && sec > 0) {
    return Math.min(MAX_SEC, Math.max(MIN_SEC, Math.ceil(sec)));
  }

  if (file.size) {
    const sizeMb = Number(file.size) / (1024 * 1024);
    const estimatedMinutes = Math.max(1, Math.min(180, Math.ceil(sizeMb * 0.8)));
    sec = estimatedMinutes * 60;
    return Math.min(MAX_SEC, Math.max(MIN_SEC, Math.ceil(sec)));
  }

  return FALLBACK_SEC;
}
