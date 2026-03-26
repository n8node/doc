import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { hasFeature } from "@/lib/plan-service";
import {
  SHARED_ACCESS_EMAIL_FEATURE,
  createShareGrants,
  parseEmailList,
} from "@/lib/collaborative-share-service";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await hasFeature(userId, SHARED_ACCESS_EMAIL_FEATURE);
  if (!allowed) {
    return NextResponse.json(
      { error: "Совместный доступ по email недоступен на вашем тарифе" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const targetType = body.targetType as string;
  const fileId = typeof body.fileId === "string" ? body.fileId : null;
  const folderId = typeof body.folderId === "string" ? body.folderId : null;
  let emails: string[] = [];
  if (Array.isArray(body.emails)) {
    emails = parseEmailList(body.emails.filter((e: unknown) => typeof e === "string").join(" "));
  } else if (typeof body.emails === "string") {
    emails = parseEmailList(body.emails);
  }
  if (emails.length === 0) {
    return NextResponse.json({ error: "Укажите хотя бы один email" }, { status: 400 });
  }

  const allowCollections = body.allowCollections === true;
  const allowAiFeatures = body.allowAiFeatures === true;

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (!Number.isNaN(d.getTime())) expiresAt = d;
  }

  if (targetType !== "FILE" && targetType !== "FOLDER") {
    return NextResponse.json({ error: "targetType FILE or FOLDER" }, { status: 400 });
  }

  try {
    const created = await createShareGrants({
      ownerUserId: userId,
      targetType,
      fileId: targetType === "FILE" ? fileId : null,
      folderId: targetType === "FOLDER" ? folderId : null,
      emails,
      allowCollections,
      allowAiFeatures,
      expiresAt,
    });
    return NextResponse.json({
      ok: true,
      count: created.length,
      grants: created.map((g) => ({
        id: g.id,
        recipientEmail: g.recipientEmail,
        status: g.status,
        expiresAt: g.expiresAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 400 }
    );
  }
}
