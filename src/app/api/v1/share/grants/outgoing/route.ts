import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { listOutgoingGrantsForTarget } from "@/lib/collaborative-share-service";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType");
  const fileId = searchParams.get("fileId");
  const folderId = searchParams.get("folderId");

  if (targetType !== "FILE" && targetType !== "FOLDER") {
    return NextResponse.json({ error: "targetType required" }, { status: 400 });
  }
  if (targetType === "FILE" && !fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }
  if (targetType === "FOLDER" && !folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const grants = await listOutgoingGrantsForTarget(
    userId,
    targetType,
    targetType === "FILE" ? fileId : null,
    targetType === "FOLDER" ? folderId : null
  );

  return NextResponse.json({
    grants: grants.map((g) => ({
      id: g.id,
      recipientEmail: g.recipientEmail,
      recipientUserId: g.recipientUserId,
      status: g.status,
      allowCollections: g.allowCollections,
      allowAiFeatures: g.allowAiFeatures,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      acceptedAt: g.acceptedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      recipient: g.recipient,
    })),
  });
}
