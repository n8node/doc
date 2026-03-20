import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import type { Profile } from "next-auth";
import { configStore } from "./config-store";

/** Email из VK OAuth или плейсхолдер (как у Telegram). */
export function deriveVkUserEmail(profile: Profile & { screen_name?: string | null }, vkId: bigint): {
  email: string;
  name: string | null;
  isEmailVerified: boolean;
} {
  const raw = profile.email;
  if (typeof raw === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
    return {
      email: raw.trim().toLowerCase(),
      name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : null,
      isEmailVerified: true,
    };
  }
  return {
    email: `vk_${vkId}@qoqon.placeholder`,
    name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : null,
    isEmailVerified: true,
  };
}

export async function randomPasswordHash(): Promise<string> {
  const randomPassword = randomBytes(32).toString("hex");
  return hash(randomPassword, 12);
}

/**
 * Client ID и Secret: сначала AdminConfig (auth.vk_client_*), иначе VK_CLIENT_ID / VK_CLIENT_SECRET из окружения.
 */
export async function resolveVkOAuthCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const [cid, sec] = await Promise.all([
    configStore.get("auth.vk_client_id"),
    configStore.get("auth.vk_client_secret"),
  ]);
  const clientId = (cid?.trim() || process.env.VK_CLIENT_ID?.trim() || "") || "";
  const clientSecret = (sec?.trim() || process.env.VK_CLIENT_SECRET?.trim() || "") || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
