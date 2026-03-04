import { prisma } from "@/lib/prisma";
import { AiProviderFactory } from "./factory";
import { decryptApiKey } from "./encrypt";
import type { AiProvider } from "./provider.interface";
import type { AiProviderConfig } from "./types";

export async function getActiveProvider(): Promise<{
  provider: AiProvider;
  providerId: string;
  providerName: string;
} | null> {
  const row = await prisma.aiProvider.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!row) return null;

  const config: AiProviderConfig = {
    type: row.type as AiProviderConfig["type"],
    baseUrl: row.baseUrl ?? undefined,
    apiKey: row.apiKey ? decryptApiKey(row.apiKey) : undefined,
    modelName: row.modelName ?? "text-embedding-3-small",
    folderId: row.folderId ?? undefined,
  };

  const provider = AiProviderFactory.create(row.name, config);

  return {
    provider,
    providerId: row.id,
    providerName: row.name,
  };
}
