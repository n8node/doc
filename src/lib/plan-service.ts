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
      embeddingTokensQuota: user.plan.embeddingTokensQuota,
      features: (user.plan.features as Record<string, boolean>) ?? {},
    };
  }
  return {
    id: "free",
    name: "Бесплатный",
    storageQuota: user.storageQuota,
    maxFileSize: user.maxFileSize,
    embeddingTokensQuota: null,
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
