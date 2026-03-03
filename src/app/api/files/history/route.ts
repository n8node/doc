import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listHistoryEvents } from "@/lib/history-service";

type HistoryFileInfo = {
  id: string | null;
  name: string;
  size: number | null;
};

type HistoryResponseItem = {
  id: string;
  action: string;
  createdAt: string;
  summary: string;
  files: HistoryFileInfo[];
};

function pluralizeFiles(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "файл";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "файла";
  return "файлов";
}

function pickFilesFromPayload(payload: Record<string, unknown> | null): HistoryFileInfo[] {
  if (!payload) return [];

  const fromArray = payload.files;
  if (Array.isArray(fromArray)) {
    return fromArray
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const obj = item as Record<string, unknown>;
        const name = typeof obj.name === "string" ? obj.name : "";
        if (!name) return null;
        return {
          id: typeof obj.id === "string" ? obj.id : null,
          name,
          size: typeof obj.size === "number" ? obj.size : null,
        };
      })
      .filter((item): item is HistoryFileInfo => item !== null);
  }

  const single = payload.file;
  if (single && typeof single === "object") {
    const obj = single as Record<string, unknown>;
    if (typeof obj.name === "string" && obj.name) {
      return [
        {
          id: typeof obj.id === "string" ? obj.id : null,
          name: obj.name,
          size: typeof obj.size === "number" ? obj.size : null,
        },
      ];
    }
  }

  return [];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsedLimit = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(Math.trunc(parsedLimit), 500)
      : 200;

  const rows = await listHistoryEvents(session.user.id, limit);

  const items: HistoryResponseItem[] = [];
  const uploadBatchIndex = new Map<string, number>();
  const uploadBatchFolderName = new Map<string, string | null>();

  for (const row of rows) {
    const files = pickFilesFromPayload(row.payload);
    if (row.action === "upload" && row.batchId) {
      const existingIndex = uploadBatchIndex.get(row.batchId);
      if (existingIndex != null) {
        const existing = items[existingIndex];
        existing.files.push(...files);
        const total = existing.files.length;
        const folderName = uploadBatchFolderName.get(row.batchId) ?? null;
        existing.summary = folderName
          ? `Вы загрузили ${total} ${pluralizeFiles(total)} в папку "${folderName}"`
          : `Вы загрузили ${total} ${pluralizeFiles(total)}`;
        continue;
      }

      const folderName =
        row.payload && typeof row.payload.folderName === "string"
          ? row.payload.folderName
          : null;
      uploadBatchFolderName.set(row.batchId, folderName);
      const item: HistoryResponseItem = {
        id: `batch:${row.batchId}`,
        action: row.action,
        createdAt: row.createdAt,
        summary: folderName
          ? `Вы загрузили ${files.length} ${pluralizeFiles(files.length)} в папку "${folderName}"`
          : `Вы загрузили ${files.length} ${pluralizeFiles(files.length)}`,
        files,
      };
      uploadBatchIndex.set(row.batchId, items.length);
      items.push(item);
      continue;
    }

    items.push({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      summary: row.summary,
      files,
    });
  }

  return NextResponse.json({ events: items });
}
