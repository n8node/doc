import { getUserPlan } from "@/lib/plan-service";
import { getWebImportPagesUsedThisMonth } from "./web-import-pages-usage";
import { estimateWebImportPagesForJob } from "./estimate-pages";

export { estimateWebImportPagesForJob };

export async function assertCanAddWebImportPage(
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getUserPlan(userId);
  if (!plan) {
    return { ok: false, message: "Пользователь не найден." };
  }
  const features = plan.features ?? {};
  if (features.web_import !== true) {
    return { ok: false, message: "Парсинг сайтов недоступен по тарифу." };
  }
  const quota = plan.webImportPagesQuota ?? null;
  if (quota == null) return { ok: true };
  const used = await getWebImportPagesUsedThisMonth(userId);
  if (used >= quota) {
    return {
      ok: false,
      message: `Лимит страниц парсинга исчерпан (${used}/${quota} в этом месяце).`,
    };
  }
  return { ok: true };
}

export async function assertWebImportJobAllowed(
  userId: string,
  estimatedPages: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const plan = await getUserPlan(userId);
  if (!plan) {
    return { ok: false, message: "Пользователь не найден." };
  }
  const features = plan.features ?? {};
  if (features.web_import !== true) {
    return { ok: false, message: "Парсинг сайтов недоступен по тарифу." };
  }
  const quota = plan.webImportPagesQuota ?? null;
  if (quota == null) return { ok: true };
  const used = await getWebImportPagesUsedThisMonth(userId);
  if (used + estimatedPages > quota) {
    return {
      ok: false,
      message: `Недостаточно лимита страниц парсинга: использовано ${used} из ${quota}, для задачи нужно до ${estimatedPages} страниц.`,
    };
  }
  return { ok: true };
}
