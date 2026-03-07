import { prisma } from "@/lib/prisma";
import { AiProviderFactory } from "./factory";
import { decryptApiKey } from "./encrypt";
import type { AiProvider } from "./provider.interface";
import type { AiProviderConfig } from "./types";
import { getActiveProvider } from "./get-active-provider";
import { getUserPlan } from "@/lib/plan-service";

export interface ProviderForUserResult {
  provider: AiProvider;
  providerId: string | null;
  providerName: string;
  usedOwnKey: boolean;
}

/**
 * Get AI provider for a user: either user's own config (if plan allows and is active)
 * or the system provider.
 */
export async function getProviderForUser(userId: string): Promise<ProviderForUserResult | null> {
  const plan = await getUserPlan(userId);
  const features = (plan?.features ?? {}) as Record<string, boolean>;
  const canUseOwnKeys = features.own_ai_keys === true;

  if (canUseOwnKeys) {
    const userConfig = await prisma.userAiConfig.findUnique({
      where: { userId, isActive: true },
    });
    if (userConfig && userConfig.apiKey) {
      const apiKey = decryptApiKey(userConfig.apiKey);
      if (apiKey?.trim()) {
        const config: AiProviderConfig = {
          type: "CLOUD",
          baseUrl: userConfig.baseUrl ?? undefined,
          apiKey: apiKey.trim(),
          modelName: userConfig.embeddingModel,
          chatModelName: userConfig.chatModel,
          folderId: userConfig.folderId ?? undefined,
        };
        const provider = AiProviderFactory.create(userConfig.providerName, config);
        return {
          provider,
          providerId: userConfig.id,
          providerName: userConfig.providerName,
          usedOwnKey: true,
        };
      }
    }
  }

  const active = await getActiveProvider();
  if (!active) return null;

  return {
    provider: active.provider,
    providerId: active.providerId,
    providerName: active.providerName,
    usedOwnKey: false,
  };
}

export async function userUsesOwnKey(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const features = (plan?.features ?? {}) as Record<string, boolean>;
  if (features.own_ai_keys !== true) return false;

  const config = await prisma.userAiConfig.findUnique({
    where: { userId, isActive: true },
    select: { apiKey: true },
  });
  return !!(config?.apiKey);
}
