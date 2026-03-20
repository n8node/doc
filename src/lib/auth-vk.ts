import { cookies, headers } from "next/headers";
import type { Account, Profile } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { prisma } from "./prisma";
import { getAuthSettings } from "./telegram-auth";
import { deriveVkUserEmail, randomPasswordHash } from "./vk-oauth";
import {
  consumeActiveInvite,
  createInvites,
  isInviteCodeFormatValid,
  normalizeInviteCode,
} from "./invite";
import { getTelegramConfig, sendTelegramMessage, formatRegisterMessage } from "./telegram";
import { evaluateRegistrationSpamAndNotify } from "./invite-abuse";

/** В колбэке OAuth иногда `cookies()` пустой; заголовок Cookie надёжнее. */
function parseCookieHeader(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const p of parts) {
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length));
      } catch {
        return p.slice(prefix.length);
      }
    }
  }
  return undefined;
}

async function getVkOAuthPayload(): Promise<{
  mode: string;
  linkUserId: string | null;
  inviteCode: string;
}> {
  const cookieStore = await cookies();
  const h = await headers();
  const raw = h.get("cookie") ?? "";

  const get = (name: string): string | undefined => {
    const v = cookieStore.get(name)?.value;
    if (v != null && v !== "") return v;
    return parseCookieHeader(raw, name);
  };

  return {
    mode: get("oauth_vk_mode") ?? "login",
    linkUserId: get("oauth_vk_link_user") ?? null,
    inviteCode: get("oauth_vk_invite") ?? "",
  };
}

export async function clearVkOAuthCookies(): Promise<void> {
  try {
    const c = await cookies();
    c.delete("oauth_vk_mode");
    c.delete("oauth_vk_invite");
    c.delete("oauth_vk_link_user");
  } catch {
    // no request context
  }
}

export async function validateVkSignIn(params: {
  account: Account | null;
  profile: Profile;
}): Promise<boolean> {
  const { account, profile } = params;
  if (!account || account.provider !== "vk") return true;
  if (!account.providerAccountId) return false;

  const vkId = BigInt(account.providerAccountId);
  const existing = await prisma.user.findUnique({ where: { vkUserId: vkId } });
  const { mode, linkUserId, inviteCode } = await getVkOAuthPayload();

  if (existing) {
    if (existing.isBlocked) return false;
    if (mode === "link" && linkUserId && existing.id !== linkUserId) return false;
    return true;
  }

  if (mode === "link" && linkUserId) {
    const target = await prisma.user.findUnique({ where: { id: linkUserId } });
    if (!target || target.isBlocked || target.vkUserId != null) return false;
    return true;
  }

  const settings = await getAuthSettings();
  if (!settings.vkOAuthEnabled) return false;

  if (mode === "login") {
    const raw = profile.email;
    if (typeof raw === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
      const byEmail = await prisma.user.findUnique({
        where: { email: raw.trim().toLowerCase() },
        select: { isBlocked: true, vkUserId: true },
      });
      if (byEmail && !byEmail.isBlocked && byEmail.vkUserId == null) {
        return true;
      }
    }
  }

  if (mode === "register" || mode === "login") {
    if (settings.inviteRegistrationEnabled) {
      if (!isInviteCodeFormatValid(normalizeInviteCode(inviteCode))) return false;
    }
    const derived = deriveVkUserEmail(profile, vkId);
    const conflict = await prisma.user.findUnique({ where: { email: derived.email } });
    if (conflict) return false;
    if (mode === "login") {
      const raw = profile.email;
      if (!raw || typeof raw !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export async function handleVkJwt(params: {
  token: JWT;
  account: Account;
  profile: Profile & { screen_name?: string | null };
}): Promise<JWT> {
  const { token, account, profile } = params;
  const vkId = BigInt(account.providerAccountId!);

  const existing = await prisma.user.findUnique({
    where: { vkUserId: vkId },
    select: { id: true, role: true, isBlocked: true },
  });

  if (existing) {
    if (existing.isBlocked) {
      await clearVkOAuthCookies();
      throw new Error("VK_BLOCKED");
    }
    const row = await prisma.user.findUnique({
      where: { id: existing.id },
      select: { email: true, role: true },
    });
    await prisma.user.update({
      where: { id: existing.id },
      data: { lastLoginAt: new Date() },
    });
    await clearVkOAuthCookies();
    return {
      ...token,
      id: existing.id,
      role: row?.role ?? existing.role,
      email: row?.email,
      checkedAt: Date.now(),
    };
  }

  const { mode, linkUserId, inviteCode: inviteCookie } = await getVkOAuthPayload();

  if (mode === "link" && linkUserId) {
    const target = await prisma.user.findUnique({ where: { id: linkUserId } });
    if (!target || target.isBlocked || target.vkUserId != null) {
      await clearVkOAuthCookies();
      throw new Error("VK_LINK_INVALID");
    }
    const screenName =
      typeof profile.screen_name === "string" && profile.screen_name.trim()
        ? profile.screen_name.trim()
        : null;
    await prisma.user.update({
      where: { id: linkUserId },
      data: {
        vkUserId: vkId,
        vkScreenName: screenName,
        lastLoginAt: new Date(),
      },
    });
    await clearVkOAuthCookies();
    return {
      ...token,
      id: linkUserId,
      role: target.role,
      email: target.email,
      checkedAt: Date.now(),
    };
  }

  if (mode === "login") {
    const raw = profile.email;
    if (typeof raw === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
      const u = await prisma.user.findUnique({
        where: { email: raw.trim().toLowerCase() },
        select: { id: true, isBlocked: true, vkUserId: true, role: true, email: true },
      });
      if (u && !u.isBlocked && u.vkUserId == null) {
        const screenName =
          typeof profile.screen_name === "string" && profile.screen_name.trim()
            ? profile.screen_name.trim()
            : null;
        await prisma.user.update({
          where: { id: u.id },
          data: {
            vkUserId: vkId,
            vkScreenName: screenName,
            lastLoginAt: new Date(),
          },
        });
        await clearVkOAuthCookies();
        return {
          ...token,
          id: u.id,
          role: u.role,
          email: u.email,
          checkedAt: Date.now(),
        };
      }
    }
  }

  const settings = await getAuthSettings();
  if (!settings.vkOAuthEnabled || (mode !== "register" && mode !== "login")) {
    await clearVkOAuthCookies();
    throw new Error("VK_REGISTER_DENIED");
  }

  const normalizedInvite = normalizeInviteCode(String(inviteCookie ?? ""));
  if (settings.inviteRegistrationEnabled) {
    if (!isInviteCodeFormatValid(normalizedInvite)) {
      await clearVkOAuthCookies();
      throw new Error("VK_INVITE_INVALID");
    }
  }

  const derived = deriveVkUserEmail(profile, vkId);
  const passwordHash = await randomPasswordHash();
  const freePlan = await prisma.plan.findFirst({ where: { isFree: true } });
  const screenName =
    typeof profile.screen_name === "string" && profile.screen_name.trim()
      ? profile.screen_name.trim()
      : null;

  let createdUserId = "";
  let consumedInviteId: string | null = null;
  let spamRootUserId: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: derived.email,
          passwordHash,
          name: derived.name,
          isEmailVerified: derived.isEmailVerified,
          emailVerifiedAt: derived.isEmailVerified ? new Date() : null,
          role: "USER",
          vkUserId: vkId,
          vkScreenName: screenName,
          planId: freePlan?.id ?? null,
          storageQuota: freePlan?.storageQuota ?? BigInt(25 * 1024 * 1024 * 1024),
          maxFileSize: freePlan?.maxFileSize ?? BigInt(512 * 1024 * 1024),
        },
      });
      createdUserId = user.id;

      if (settings.inviteRegistrationEnabled) {
        const invite = await consumeActiveInvite({
          tx,
          code: normalizedInvite,
          usedByUserId: user.id,
        });
        consumedInviteId = invite.id;
        spamRootUserId = invite.ownerUserId ?? null;

        await createInvites({
          tx,
          scope: "USER",
          count: 3,
          ownerUserId: user.id,
          createdByUserId: user.id,
        });
      }

      if (consumedInviteId) {
        await tx.user.update({
          where: { id: user.id },
          data: { registeredViaInviteId: consumedInviteId },
        });
      }
    });
  } catch (e) {
    await clearVkOAuthCookies();
    throw e;
  }

  try {
    const tg = await getTelegramConfig();
    if (tg.notifyRegisterEnabled && tg.botToken && tg.chatId && createdUserId) {
      let inviteCode: string | null = null;
      let inviteScope: "SYSTEM" | "USER" | null = null;
      let inviteOwner: string | null = null;
      if (consumedInviteId) {
        const inviteWithOwner = await prisma.invite.findUnique({
          where: { id: consumedInviteId },
          include: { ownerUser: { select: { email: true, name: true } } },
        });
        if (inviteWithOwner) {
          inviteCode = inviteWithOwner.code;
          inviteScope = inviteWithOwner.scope;
          inviteOwner = inviteWithOwner.ownerUser
            ? `${inviteWithOwner.ownerUser.email}${inviteWithOwner.ownerUser.name ? ` (${inviteWithOwner.ownerUser.name})` : ""}`
            : null;
        }
      }
      const text = formatRegisterMessage(tg.registerMessage, {
        email: derived.email,
        name: derived.name,
        inviteCode,
        inviteScope,
        inviteOwner,
      });
      await sendTelegramMessage(tg.botToken, tg.chatId, text);
    }
  } catch {
    // ignore
  }

  if (spamRootUserId) {
    await evaluateRegistrationSpamAndNotify({ rootUserId: spamRootUserId }).catch(() => {});
  }

  const created = await prisma.user.findUnique({
    where: { id: createdUserId },
    select: { id: true, role: true },
  });
  if (!created) {
    await clearVkOAuthCookies();
    throw new Error("VK_CREATE_FAILED");
  }

  await clearVkOAuthCookies();
  return {
    ...token,
    id: created.id,
    role: created.role,
    email: derived.email,
    checkedAt: Date.now(),
  };
}
