import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import {
  buildOnlyOfficeDocumentKey,
  getOnlyOfficeFileTypeAndKind,
  isOnlyOfficeEditable,
} from "@/lib/onlyoffice/mime-editable";
import { buildSignedOnlyofficeEditorBootstrap } from "@/lib/onlyoffice/build-config";
import { isOnlyofficeConfigured } from "@/lib/onlyoffice/env";

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  if (!isOnlyofficeConfigured()) {
    return NextResponse.json(
      { error: "ONLYOFFICE не настроен на сервере" },
      { status: 503 }
    );
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId, deletedAt: null },
  });
  if (!file) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  }

  if (!isOnlyOfficeEditable(file.mimeType, file.name)) {
    return NextResponse.json({ error: "Формат не поддерживается редактором" }, { status: 400 });
  }

  const ft = getOnlyOfficeFileTypeAndKind(file.mimeType, file.name);
  if (!ft) {
    return NextResponse.json({ error: "Формат не поддерживается редактором" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const userName = user?.name?.trim() || user?.email?.split("@")[0] || "User";

  const bootstrap = await buildSignedOnlyofficeEditorBootstrap({
    fileId: file.id,
    fileName: file.name,
    fileType: ft.fileType,
    documentType: ft.documentType,
    documentKey: buildOnlyOfficeDocumentKey(file.id, file.updatedAt),
    userId,
    userName,
  });

  if ("error" in bootstrap) {
    return NextResponse.json({ error: bootstrap.error }, { status: 503 });
  }

  console.log(
    `[onlyoffice config] ok fileId=${file.id} documentFetchBase=${bootstrap.documentFetchBase}`
  );

  return NextResponse.json(bootstrap);
}
