import { createHash, randomBytes } from "crypto";
import { EmailVerificationPurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { getPublicBaseUrl } from "./app-url";
import { getEmailTemplate, type EmailTemplateKey, renderTemplate } from "./email-templates";
import { sendEmail } from "./email-sender";

const DEFAULT_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issueEmailVerificationToken(params: {
  userId: string;
  purpose: EmailVerificationPurpose;
  newEmail?: string;
  newPasswordHash?: string;
  ttlMinutes?: number;
}): Promise<{ token: string; expiresAt: Date; ttlMinutes: number }> {
  const ttlMinutes = params.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId: params.userId,
      purpose: params.purpose,
      usedAt: null,
    },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: params.userId,
      purpose: params.purpose,
      tokenHash,
      newEmail: params.newEmail ?? null,
      newPasswordHash: params.newPasswordHash ?? null,
      expiresAt,
    },
  });

  return { token, expiresAt, ttlMinutes };
}

export async function resolveEmailVerificationToken(token: string) {
  const tokenHash = hashToken(token);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
  });

  if (!row || row.usedAt) return { ok: false as const, reason: "INVALID_TOKEN" as const };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "TOKEN_EXPIRED" as const };
  }

  return { ok: true as const, tokenRow: row };
}

export async function markEmailVerificationTokenUsed(tokenId: string) {
  await prisma.emailVerificationToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

export async function sendVerificationEmail(params: {
  email: string;
  templateKey: EmailTemplateKey;
  token: string;
  ttlMinutes: number;
}): Promise<{ ok: boolean; error?: string }> {
  const verifyLink = `${getPublicBaseUrl()}/auth/verify-email?token=${encodeURIComponent(params.token)}`;
  const template = await getEmailTemplate(params.templateKey);
  const vars = {
    verifyLink,
    expiresMinutes: String(params.ttlMinutes),
  };

  return sendEmail({
    to: params.email,
    subject: renderTemplate(template.subject, vars),
    html: renderTemplate(template.html, vars),
    text: renderTemplate(template.text, vars),
  });
}
