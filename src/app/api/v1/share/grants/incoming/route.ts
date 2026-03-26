import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  linkPendingGrantsToUser,
  listIncomingGrants,
} from "@/lib/collaborative-share-service";

export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "No email" }, { status: 400 });
  }

  await linkPendingGrantsToUser(userId, user.email);
  const grants = await listIncomingGrants(userId, user.email);
  return NextResponse.json({
    grants: grants.map((g) => ({
      id: g.id,
      status: g.status,
      targetType: g.targetType,
      allowCollections: g.allowCollections,
      allowAiFeatures: g.allowAiFeatures,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      acceptedAt: g.acceptedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
      owner: g.owner,
      file: g.file
        ? {
            id: g.file.id,
            name: g.file.name,
            mimeType: g.file.mimeType,
            size: Number(g.file.size),
            createdAt: g.file.createdAt.toISOString(),
          }
        : null,
      folder: g.folder
        ? {
            id: g.folder.id,
            name: g.folder.name,
            createdAt: g.folder.createdAt.toISOString(),
          }
        : null,
    })),
  });
}
