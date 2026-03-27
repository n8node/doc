/** Данные тарифа из GET /api/v1/plans */
export interface PlanItem {
  id: string;
  name: string;
  isFree: boolean;
  isPopular: boolean;
  storageQuota: number;
  maxFileSize: number;
  features: Record<string, boolean>;
  aiAnalysisDocumentsQuota?: number | null;
  embeddingTokensQuota?: number | null;
  chatTokensQuota?: number | null;
  searchTokensQuota?: number | null;
  transcriptionMinutesQuota?: number | null;
  transcriptionAudioMinutesQuota?: number | null;
  transcriptionVideoMinutesQuota?: number | null;
  maxTranscriptionAudioMinutes?: number;
  maxTranscriptionVideoMinutes?: number;
  ragDocumentsQuota?: number | null;
  imageGenerationCreditsQuota?: number | null;
  webImportPagesQuota?: number | null;
  priceMonthly: number | null;
  priceYearly: number | null;
  trashRetentionDays: number;
}
