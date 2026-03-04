import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { getPublicBaseUrl } from "./app-url";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.passwordHash) return null;
        if (user.isBlocked) return null;
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
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "USER" | "ADMIN" }).role;
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
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
