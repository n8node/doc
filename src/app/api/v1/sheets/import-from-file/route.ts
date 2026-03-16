import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasFeature } from "@/lib/plan-service";
import { getStreamFromS3 } from "@/lib/s3-download";
import * as XLSX from "xlsx";

const EXCEL_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * POST /api/v1/sheets/import-from-file
 * Body: { fileId: string }
 * Imports an Excel file from "My files" into a new sheet and links it (sourceFileId).
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canUseSheets = await hasFeature(session.user.id, "sheets");
  if (!canUseSheets) {
    return NextResponse.json(
      { error: "Тариф не поддерживает таблицы. Обновите тариф." },
      { status: 403 }
    );
  }

  let body: { fileId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
  if (!fileId) {
    return NextResponse.json({ error: "fileId required" }, { status: 400 });
  }

  const file = await prisma.file.findFirst({
    where: { id: fileId, userId: session.user.id, deletedAt: null },
    select: { id: true, name: true, mimeType: true, s3Key: true },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  if (!EXCEL_MIMES.has(file.mimeType)) {
    return NextResponse.json(
      { error: "Файл должен быть Excel (.xlsx, .xls)" },
      { status: 400 }
    );
  }

  let buf: Buffer;
  try {
    const { body: s3Body } = await getStreamFromS3(file.s3Key);
    if (!s3Body) {
      return NextResponse.json({ error: "Не удалось прочитать файл из хранилища" }, { status: 500 });
    }
    const bodyAny = s3Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof bodyAny.transformToByteArray === "function") {
      buf = Buffer.from(await bodyAny.transformToByteArray());
    } else if (s3Body instanceof Readable) {
      buf = await streamToBuffer(s3Body);
    } else {
      const stream = Readable.from((s3Body as unknown) as AsyncIterable<Uint8Array>);
      buf = await streamToBuffer(stream);
    }
  } catch (err) {
    console.error("[sheets/import-from-file] S3 read:", err);
    return NextResponse.json(
      { error: "Не удалось загрузить файл" },
      { status: 500 }
    );
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch {
    return NextResponse.json(
      { error: "Не удалось прочитать файл Excel" },
      { status: 400 }
    );
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "В файле нет листов" }, { status: 400 });
  }
  const ws = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
  if (data.length === 0) {
    return NextResponse.json({ error: "Лист пустой" }, { status: 400 });
  }

  const headers = data[0].map((h, i) =>
    h != null && String(h).trim() ? String(h).trim() : `Колонка ${i + 1}`
  );
  const baseName = (file.name || "Импорт").replace(/\.[^.]+$/, "") || "Импорт";

  const sheet = await prisma.sheet.create({
    data: {
      userId: session.user.id,
      name: baseName,
      sourceFileId: file.id,
      columns: {
        create: headers.map((name, order) => ({
          order,
          name,
          dataType: "text",
        })),
      },
    },
    include: { columns: { orderBy: { order: "asc" } } },
  });
  const columnIds = sheet.columns.map((c) => c.id);
  const updates: Array<{ rowIndex: number; columnId: string; value: string | null }> = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const rowIndex = r - 1;
    for (let c = 0; c < columnIds.length; c++) {
      const raw = row?.[c];
      const value = raw == null ? null : String(raw).trim() || null;
      updates.push({ rowIndex, columnId: columnIds[c], value });
    }
  }
  for (const u of updates) {
    await prisma.sheetCell.upsert({
      where: {
        sheetId_columnId_rowIndex: {
          sheetId: sheet.id,
          columnId: u.columnId,
          rowIndex: u.rowIndex,
        },
      },
      create: {
        sheetId: sheet.id,
        columnId: u.columnId,
        rowIndex: u.rowIndex,
        value: u.value,
      },
      update: { value: u.value },
    });
  }

  return NextResponse.json({
    id: sheet.id,
    name: sheet.name,
    rowsImported: data.length - 1,
  });
}
