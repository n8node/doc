import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { resolveFileAccessForUser } from "@/lib/collaborative-share-service";
import { getStreamFromS3 } from "@/lib/s3-download";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fileIds } = body as { fileIds?: string[] };

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return NextResponse.json(
      { error: "fileIds должен быть непустым массивом" },
      { status: 400 }
    );
  }

  if (fileIds.length > 200) {
    return NextResponse.json(
      { error: "Максимум 200 файлов за раз" },
      { status: 400 }
    );
  }

  const uniqueIds = Array.from(new Set(fileIds));
  const files: Array<{ id: string; name: string; s3Key: string }> = [];
  for (const fid of uniqueIds) {
    const access = await resolveFileAccessForUser(userId, fid);
    if (access.mode === "none") continue;
    const f = access.file;
    if (f.deletedAt) continue;
    files.push({ id: f.id, name: f.name, s3Key: f.s3Key });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Файлы не найдены" }, { status: 404 });
  }

  const passthrough = new PassThrough();
  const archive = archiver("zip", { zlib: { level: 5 } });

  archive.on("error", (err) => {
    console.error("[download-archive] archiver error:", err);
    passthrough.destroy(err);
  });

  archive.pipe(passthrough);

  const nameCount = new Map<string, number>();

  (async () => {
    for (const file of files) {
      try {
        const { body: s3Body } = await getStreamFromS3(file.s3Key);
        if (!s3Body) continue;

        let fileName = file.name;
        const count = nameCount.get(fileName) ?? 0;
        if (count > 0) {
          const dotIdx = fileName.lastIndexOf(".");
          if (dotIdx > 0) {
            fileName = `${fileName.slice(0, dotIdx)} (${count})${fileName.slice(dotIdx)}`;
          } else {
            fileName = `${fileName} (${count})`;
          }
        }
        nameCount.set(file.name, count + 1);

        const bodyAny = s3Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> };
        let readable: Readable;
        if (s3Body instanceof Readable) {
          readable = s3Body;
        } else if (typeof bodyAny.transformToByteArray === "function") {
          const bytes = await bodyAny.transformToByteArray();
          readable = Readable.from(Buffer.from(bytes));
        } else {
          readable = Readable.from(s3Body as unknown as AsyncIterable<Uint8Array>);
        }

        archive.append(readable, { name: fileName });
      } catch (err) {
        console.error(`[download-archive] skip file ${file.id}:`, err);
      }
    }
    await archive.finalize();
  })();

  const webStream = new ReadableStream({
    start(controller) {
      passthrough.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      passthrough.on("end", () => {
        controller.close();
      });
      passthrough.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      archive.abort();
      passthrough.destroy();
    },
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const archiveName = files.length === 1
    ? `${files[0].name}.zip`
    : `files-${timestamp}.zip`;

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(archiveName)}"`,
      "Cache-Control": "no-store",
    },
  });
}
