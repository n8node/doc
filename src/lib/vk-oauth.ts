import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import type { Profile } from "next-auth";

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

export function isVkOAuthEnvConfigured(): boolean {
  return Boolean(process.env.VK_CLIENT_ID?.trim() && process.env.VK_CLIENT_SECRET?.trim());
}
