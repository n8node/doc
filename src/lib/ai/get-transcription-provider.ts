import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "./encrypt";

export interface TranscriptionProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

/**
 * Get transcription provider for a user's plan.
 * Returns null if plan has no transcriptionProviderId or provider is not found/invalid.
 */
export async function getTranscriptionProviderForUser(
  userId: string,
): Promise<TranscriptionProviderConfig | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planId: true, plan: { select: { transcriptionProviderId: true } } },
  });

  const providerId = user?.plan?.transcriptionProviderId;
  if (!providerId) return null;

  const provider = await prisma.aiProvider.findUnique({
    where: {
      id: providerId,
      purpose: "TRANSCRIPTION",
      isActive: true,
    },
  });

  if (!provider || !provider.apiKey) return null;

  const apiKey = decryptApiKey(provider.apiKey);
  if (!apiKey?.trim()) return null;

  const baseUrl = (provider.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const modelName = provider.modelName ?? "whisper-1";

  return {
    id: provider.id,
    name: provider.name,
    baseUrl,
    modelName,
    apiKey: apiKey.trim(),
  };
}
