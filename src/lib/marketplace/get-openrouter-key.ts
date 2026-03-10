import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/ai/encrypt";

/**
 * Get OpenRouter API key for marketplace proxy.
 * Uses admin-configured OpenRouter provider.
 */
export async function getOpenRouterApiKey(): Promise<string | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { name: "openrouter", apiKey: { not: null } },
    select: { apiKey: true },
  });
  if (!provider?.apiKey) return null;
  return decryptApiKey(provider.apiKey);
}
