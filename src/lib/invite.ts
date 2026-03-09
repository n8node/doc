import { randomBytes } from "crypto";
import { Prisma, type Invite, type InviteScope } from "@prisma/client";
import { configStore } from "@/lib/config-store";

export const INVITE_CODE_PREFIX = "QoQon_";
const INVITE_RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_RANDOM_LENGTH = 12;

export function normalizeInviteCode(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";

  if (value.toLowerCase().startsWith(INVITE_CODE_PREFIX.toLowerCase())) {
    const suffix = value.slice(INVITE_CODE_PREFIX.length).toUpperCase();
    return `${INVITE_CODE_PREFIX}${suffix}`;
  }

  return value;
}

export function isInviteCodeFormatValid(code: string): boolean {
  return /^QoQon_[A-Z0-9]{8,64}$/.test(code);
}

export function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_RANDOM_LENGTH);
  let suffix = "";
  for (let i = 0; i < INVITE_RANDOM_LENGTH; i += 1) {
    suffix += INVITE_RANDOM_ALPHABET[bytes[i] % INVITE_RANDOM_ALPHABET.length];
  }
  return `${INVITE_CODE_PREFIX}${suffix}`;
}

export async function isInviteRegistrationEnabled(): Promise<boolean> {
  const value = await configStore.get("auth.invite_registration_enabled");
  return value === "true";
}

type TxClient = Prisma.TransactionClient;

export async function createInvites(params: {
  tx: TxClient;
  scope: InviteScope;
  count: number;
  ownerUserId?: string | null;
  createdByUserId?: string | null;
}): Promise<Invite[]> {
  const { tx, scope, count, ownerUserId = null, createdByUserId = null } = params;

  const result: Invite[] = [];
  for (let i = 0; i < count; i += 1) {
    // Retry on rare unique collisions.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        const invite = await tx.invite.create({
          data: {
            code: generateInviteCode(),
            scope,
            status: "ACTIVE",
            ownerUserId,
            createdByUserId,
          },
        });
        result.push(invite);
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
        if (attempt === 5) throw error;
      }
    }
  }

  return result;
}

export async function consumeActiveInvite(params: {
  tx: TxClient;
  code: string;
  usedByUserId: string;
}): Promise<Invite> {
  const normalizedCode = normalizeInviteCode(params.code);
  if (!isInviteCodeFormatValid(normalizedCode)) {
    throw new Error("INVALID_INVITE_CODE");
  }

  const now = new Date();
  const invite = await params.tx.invite.findFirst({
    where: {
      code: normalizedCode,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  if (!invite) {
    throw new Error("INVITE_NOT_ACTIVE");
  }

  const updateRes = await params.tx.invite.updateMany({
    where: {
      id: invite.id,
      status: "ACTIVE",
      usedAt: null,
    },
    data: {
      status: "USED",
      usedAt: now,
      usedByUserId: params.usedByUserId,
    },
  });

  if (updateRes.count !== 1) {
    throw new Error("INVITE_ALREADY_CONSUMED");
  }

  return invite;
}
