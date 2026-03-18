import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getStorageFileLimitsMb, setStorageFileLimitsMb } from "@/lib/storage-file-limits";

/**
 * GET /api/v1/admin/storage-limits
 * Лимиты размера файлов по категориям (МБ): картинки, видео, архивы, остальные.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const limits = await getStorageFileLimitsMb();
  return NextResponse.json(limits);
}

/**
 * PUT /api/v1/admin/storage-limits
 * Обновить лимиты. Body: { image?: number, video?: number, archive?: number, other?: number } (МБ).
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { image?: number; video?: number; archive?: number; other?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await setStorageFileLimitsMb(body);
  const limits = await getStorageFileLimitsMb();
  return NextResponse.json(limits);
}
