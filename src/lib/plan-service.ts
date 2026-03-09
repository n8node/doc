import { prisma } from "./prisma";

const ABSOLUTE_MAX_FILE_SIZE = BigInt(5 * 1024 * 1024 * 1024); // 5 GB — жёсткий потолок

const FREE_PLAN_DEFAULTS = {
  storageQuota: BigInt(25 * 1024 * 1024 * 1024), // 25 GB
  maxFileSize: BigInt(512 * 1024 * 1024), // 512 MB
  features: {
    video_player: true,
    audio_player: true,
    share_links: true,
    folder_share: true,
    ai_search: false,
    document_chat: false,
    document_analysis: false,
    rag_memory: false,
    n8n_connection: false,
  } as Record<string, boolean>,
};

export async function getUserPlan(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { plan: true },
  });
  if (!user) return null;
  if (user.planId && user.plan) {
    return {
      id: user.plan.id,
      name: user.plan.name,
      storageQuota: user.plan.storageQuota,
      maxFileSize: user.plan.maxFileSize,
      chatTokensQuota: user.plan.chatTokensQuota,
      searchTokensQuota: user.plan.searchTokensQuota,
      embeddingTokensQuota: user.plan.embeddingTokensQuota,
      transcriptionTokensQuota: user.plan.transcriptionTokensQuota,
      aiAnalysisDocumentsQuota: user.plan.aiAnalysisDocumentsQuota,
      ragDocumentsQuota: user.plan.ragDocumentsQuota,
      transcriptionMinutesQuota: user.plan.transcriptionMinutesQuota,
      maxTranscriptionVideoMinutes: user.plan.maxTranscriptionVideoMinutes,
      maxTranscriptionAudioMinutes: user.plan.maxTranscriptionAudioMinutes,
      features: (user.plan.features as Record<string, boolean>) ?? {},
    };
  }
  return {
    id: "free",
    name: "Бесплатный",
    storageQuota: user.storageQuota,
    maxFileSize: user.maxFileSize,
    chatTokensQuota: null,
    searchTokensQuota: null,
    embeddingTokensQuota: null,
    transcriptionTokensQuota: null,
    aiAnalysisDocumentsQuota: null,
    ragDocumentsQuota: null,
    transcriptionMinutesQuota: null,
    maxTranscriptionVideoMinutes: 60,
    maxTranscriptionAudioMinutes: 120,
    features: FREE_PLAN_DEFAULTS.features,
  };
}

export async function getMaxFileSize(userId: string): Promise<bigint> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { plan: true },
  });
  if (!user) return FREE_PLAN_DEFAULTS.maxFileSize;
  const limit = user.plan ? user.plan.maxFileSize : user.maxFileSize;
  return limit > ABSOLUTE_MAX_FILE_SIZE ? ABSOLUTE_MAX_FILE_SIZE : limit;
}

export async function hasFeature(
  userId: string,
  featureKey: string
): Promise<boolean> {
  const plan = await getUserPlan(userId);
  if (!plan) return false;
  const features = plan.features ?? {};
  return features[featureKey] === true;
}

export async function checkStorageQuota(
  userId: string,
  additionalBytes: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageUsed: true, storageQuota: true, plan: true },
  });
  if (!user) return false;
  const quota = user.plan ? user.plan.storageQuota : user.storageQuota;
  return user.storageUsed + BigInt(additionalBytes) <= quota;
}
