import type { NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

type AnyOAuth = OAuthConfig<Record<string, unknown>>;
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { getPublicBaseUrl } from "./app-url";
import { verifyTelegramSessionToken } from "./telegram-session";
import { VkProviderWithEmail } from "./vk-provider";
import { VkProviderVkId } from "./vk-id-provider";
import { resolveVkOAuthCredentials } from "./vk-oauth";
import { validateVkSignIn, handleVkJwt } from "./auth-vk";
import { configStore } from "./config-store";
import { linkPendingGrantsToUser } from "./collaborative-share-service";

function createAuthOptions(vkProviders: AnyOAuth[]): NextAuthOptions {
  return {
    providers: [
      CredentialsProvider({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Пароль", type: "password" },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;

          if (credentials.email === "__telegram__") {
            const userId = verifyTelegramSessionToken(credentials.password);
            if (!userId) return null;
            const user = await prisma.user.findUnique({
              where: { id: userId },
            });
            if (!user || user.isBlocked) return null;
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
            return {
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name || user.email,
            };
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
          if (!user || !user.passwordHash) return null;
          if (user.isBlocked) return null;
          if (!user.isEmailVerified) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name || user.email,
          };
        },
      }),
      ...vkProviders,
    ],
    session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
    callbacks: {
      redirect: ({ url, baseUrl }) => {
        const base = baseUrl.includes("localhost") ? getPublicBaseUrl() : baseUrl.replace(/\/$/, "");
        if (url.startsWith("/")) return `${base}${url}`;
        try {
          const parsed = new URL(url);
          if (parsed.origin === new URL(baseUrl).origin) return `${base}${parsed.pathname}${parsed.search}`;
        } catch {
          // ignore
        }
        return base;
      },
      signIn: async ({ account, profile }) => {
        if (account?.provider === "vk" && profile) {
          return validateVkSignIn({ account, profile });
        }
        return true;
      },
      jwt: async ({ token, user, account, profile, trigger }) => {
        if (account?.provider === "vk" && profile) {
          return handleVkJwt({
            token,
            account,
            profile: profile as typeof profile & { screen_name?: string | null },
          });
        }

        if (user) {
          token.id = user.id;
          token.role = (user as { role?: "USER" | "ADMIN" }).role;
          const u = user as { email?: string | null };
          if (typeof u.email === "string") token.email = u.email;
          if (typeof u.email === "string" && typeof user.id === "string") {
            linkPendingGrantsToUser(user.id, u.email).catch(() => {});
          }
        }
        if (trigger === "update" || !token.checkedAt || Date.now() - (token.checkedAt as number) > 5 * 60 * 1000) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { isBlocked: true, role: true },
          });
          if (dbUser) {
            token.isBlocked = dbUser.isBlocked;
            token.role = dbUser.role;
          }
          token.checkedAt = Date.now();
        }
        return token;
      },
      session: ({ session, token }) => {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as "USER" | "ADMIN";
          if (typeof token.email === "string") {
            session.user.email = token.email;
          }
        }
        return session;
      },
    },
    pages: {
      signIn: "/login",
    },
  };
}

/**
 * Собирает NextAuth options: VK-провайдер только если включено в конфиге и заданы id/secret (БД или env).
 */
/** Эффективный режим VK OAuth: переменная `VK_OAUTH_PROTOCOL` перекрывает значение из БД. */
export function resolveVkProtocol(raw: string | null | undefined): "classic" | "vkid" {
  const v = (process.env.VK_OAUTH_PROTOCOL ?? raw ?? "classic").trim().toLowerCase();
  return v === "vkid" ? "vkid" : "classic";
}

export async function buildAuthOptions(): Promise<NextAuthOptions> {
  const vkFlag = await configStore.get("auth.vk_oauth_enabled");
  const creds = await resolveVkOAuthCredentials();
  /** В БД могло остаться auth.vk_oauth_enabled=false; `VK_OAUTH_ENABLED=true` в .env включает VK при заданных ключах. */
  const vkForcedByEnv = process.env.VK_OAUTH_ENABLED === "true";
  const vkEnabled = creds !== null && (vkFlag !== "false" || vkForcedByEnv);
  const vkProtocol = resolveVkProtocol(await configStore.get("auth.vk_oauth_protocol"));
  const vkProviders =
    vkEnabled && creds
      ? vkProtocol === "vkid"
        ? [VkProviderVkId({ clientId: creds.clientId, clientSecret: creds.clientSecret })]
        : [VkProviderWithEmail({ clientId: creds.clientId, clientSecret: creds.clientSecret })]
      : [];
  return createAuthOptions(vkProviders);
}

/**
 * Один и тот же объект на весь процесс — NextAuth(authOptions) держит ссылку из замыкания;
 * при замене `authOptions = ...` обработчик продолжал бы видеть старые провайдеры без VK.
 */
export const authOptions: NextAuthOptions = createAuthOptions([]);

export async function refreshAuthOptions(): Promise<void> {
  const next = await buildAuthOptions();
  authOptions.providers = next.providers;
}
