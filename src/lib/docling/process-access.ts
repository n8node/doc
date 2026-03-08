import { NextResponse } from "next/server";
import { getAnalysisDocumentsUsedThisMonth } from "@/lib/ai/analysis-documents-usage";
import { getUserPlan } from "@/lib/plan-service";

/**
 * Check if user can run document analysis (plan feature + quota).
 * Returns NextResponse on error, null if allowed.
 */
export async function checkDocumentAnalysisAccess(
  userId: string,
  documentsToProcess: number
): Promise<NextResponse | null> {
  const plan = await getUserPlan(userId);
  if (!plan) return null;

  const features = (plan.features ?? {}) as Record<string, unknown>;
  if (features.document_analysis !== true) {
    return NextResponse.json(
      {
        error:
          "AI-анализ документов недоступен по вашему тарифу. Обновите тариф для доступа.",
        code: "DOCUMENT_ANALYSIS_DISABLED",
      },
      { status: 403 }
    );
  }

  const quota = plan.aiAnalysisDocumentsQuota ?? null;
  if (quota == null) return null;

  const used = await getAnalysisDocumentsUsedThisMonth(userId);
  const afterProcess = used + documentsToProcess;
  if (afterProcess > quota) {
    return NextResponse.json(
      {
        error:
          documentsToProcess === 1
            ? `Лимит документов AI-анализа по вашему тарифу исчерпан (${used}/${quota} в этом месяце). Обновите тариф или дождитесь следующего месяца.`
            : `Недостаточно лимита документов AI-анализа. Использовано ${used}/${quota}. Осталось ${Math.max(0, quota - used)}.`,
        code: "AI_ANALYSIS_DOCUMENTS_QUOTA_EXCEEDED",
        used,
        quota,
      },
      { status: 403 }
    );
  }
  return null;
}
