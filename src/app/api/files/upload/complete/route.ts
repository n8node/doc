import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { createFileRecordFromS3Object } from "@/lib/file-service";
import { headUploadedObject } from "@/lib/s3-upload";
import { verifyUploadSessionToken } from "@/lib/upload-session";

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const token =
    body &&
    typeof body === "object" &&
    "uploadSessionToken" in body &&
    typeof (body as { uploadSessionToken?: unknown }).uploadSessionToken === "string"
      ? (body as { uploadSessionToken: string }).uploadSessionToken
      : "";

  if (!token) {
    return NextResponse.json({ error: "uploadSessionToken обязателен" }, { status: 400 });
  }

  const payload = verifyUploadSessionToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Сессия загрузки недействительна или истекла" }, { status: 400 });
  }

  if (payload.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const uploadedObject = await headUploadedObject(payload.s3Key);
  if (!uploadedObject || uploadedObject.size == null) {
    return NextResponse.json({ error: "Файл не найден в хранилище" }, { status: 409 });
  }

  if (uploadedObject.size !== payload.size) {
    return NextResponse.json(
      { error: "Размер загруженного файла не совпадает с ожидаемым" },
      { status: 409 }
    );
  }

  try {
    const created = await createFileRecordFromS3Object({
      userId: payload.userId,
      name: payload.name,
      mimeType: uploadedObject.contentType ?? payload.mimeType,
      size: payload.size,
      s3Key: payload.s3Key,
      folderId: payload.folderId,
      mediaDurationSeconds: payload.mediaDurationSeconds,
      clientBatchId: payload.clientBatchId ?? null,
    });

    return NextResponse.json({
      id: created.id,
      name: created.name,
      mimeType: created.mimeType,
      size: Number(created.size),
      s3Key: created.s3Key,
      folderId: created.folderId,
      mediaMetadata: created.mediaMetadata,
      createdAt: created.createdAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка завершения загрузки" },
      { status: 500 }
    );
  }
}
