import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Expected multipart/form-data with file" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
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
  const headers = data[0].map((h, i) => (h != null && String(h).trim() ? String(h).trim() : `Колонка ${i + 1}`));
  const baseName = (file.name || "Импорт").replace(/\.[^.]+$/, "") || "Импорт";
  const sheet = await prisma.sheet.create({
    data: {
      userId: session.user.id,
      name: baseName,
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
        sheetId_columnId_rowIndex: { sheetId: sheet.id, columnId: u.columnId, rowIndex: u.rowIndex },
      },
      create: { sheetId: sheet.id, columnId: u.columnId, rowIndex: u.rowIndex, value: u.value },
      update: { value: u.value },
    });
  }
  return NextResponse.json({
    id: sheet.id,
    name: sheet.name,
    rowsImported: data.length - 1,
  });
}
