import { prisma } from "./prisma";

const FREE_PLAN_DEFAULTS = {
  storageQuota: BigInt(25 * 1024 * 1024 * 1024), // 25 GB
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
      features: (user.plan.features as Record<string, boolean>) ?? {},
    };
  }
  return {
    id: "free",
    name: "Бесплатный",
    storageQuota: user.storageQuota,
    features: FREE_PLAN_DEFAULTS.features,
  };
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
