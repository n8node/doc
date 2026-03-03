import { createHmac, timingSafeEqual } from "crypto";

const UPLOAD_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface UploadSessionPayload {
  userId: string;
  s3Key: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  mediaDurationSeconds: number | null;
  expiresAt: number;
}

function getSigningSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }
  return secret;
}

function sign(data: string) {
  return createHmac("sha256", getSigningSecret()).update(data).digest("base64url");
}

export function createUploadSessionToken(
  payload: Omit<UploadSessionPayload, "expiresAt">
) {
  const withExpiry: UploadSessionPayload = {
    ...payload,
    expiresAt: Date.now() + UPLOAD_SESSION_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(withExpiry), "utf-8").toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUploadSessionToken(token: string): UploadSessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    ) as UploadSessionPayload;

    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.s3Key !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.mimeType !== "string" ||
      typeof parsed.size !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
