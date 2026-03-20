import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadUserFileFromBuffer } from "@/lib/file-service";
import { getEffectiveMaxFileSize } from "@/lib/plan-service";
import {
  buildParsingExportFileName,
  getWebImportSiteSlugForFilename,
} from "@/lib/web-import/export-filename";
import type { WebImportPageRow } from "@/lib/web-import/process-job";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.webImportJob.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "md").toLowerCase();
  const pageId = searchParams.get("pageId");
  const pageIdsParam = searchParams.get("pageIds");

  const pages = job.pages as unknown as WebImportPageRow[];
  const idsFromParam =
    pageIdsParam
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const selected =
    idsFromParam.length > 0 && pages.length
      ? pages.filter((p) => idsFromParam.includes(p.id))
      : pageId && pages.length
        ? pages.filter((p) => p.id === pageId)
        : pages.filter((p) => p.markdown && p.status === "done");

  if (!selected.length) {
    return NextResponse.json({ error: "Нет данных для экспорта" }, { status: 400 });
  }

  if (format === "json") {
    const body = JSON.stringify(
      {
        jobId: job.id,
        mode: job.mode,
        exportedAt: new Date().toISOString(),
        pages: selected.map((p) => ({
          id: p.id,
          url: p.url,
          title: p.title,
          markdown: p.markdown,
          links: p.links,
        })),
      },
      null,
      2,
    );
    const siteSlug = getWebImportSiteSlugForFilename({
      input: job.input,
      pages: selected,
    });
    const downloadName = buildParsingExportFileName(siteSlug, "json");
    const buf = Buffer.from(body, "utf-8");
    const maxSize = await getEffectiveMaxFileSize(
      session.user.id,
      "application/json",
      downloadName,
    );
    if (BigInt(buf.length) > maxSize) {
      return NextResponse.json(
        { error: "Экспорт слишком большой для сохранения по тарифу" },
        { status: 413 },
      );
    }
    try {
      const saved = await uploadUserFileFromBuffer({
        userId: session.user.id,
        fileName: downloadName,
        mimeType: "application/json; charset=utf-8",
        buffer: buf,
      });
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${downloadName}"`,
          "X-Saved-File-Id": saved.id,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка сохранения";
      return NextResponse.json(
        { error: msg, code: "EXPORT_SAVE_FAILED" },
        { status: 500 },
      );
    }
  }

  if (format === "pdf") {
    return NextResponse.json({ error: "Экспорт в PDF отключён" }, { status: 410 });
  }

  // markdown default
  const mdParts = selected.map(
    (p) =>
      `# ${p.title ?? "Без заголовка"}\n\n**URL:** ${p.url}\n\n${p.markdown ?? ""}`,
  );
  const md = mdParts.join("\n\n---\n\n");
  const siteSlug = getWebImportSiteSlugForFilename({
    input: job.input,
    pages: selected,
  });
  const downloadName = buildParsingExportFileName(siteSlug, "md");
  const buf = Buffer.from(md, "utf-8");
  const maxSize = await getEffectiveMaxFileSize(
    session.user.id,
    "text/markdown",
    downloadName,
  );
  if (BigInt(buf.length) > maxSize) {
    return NextResponse.json(
      { error: "Экспорт слишком большой для сохранения по тарифу" },
      { status: 413 },
    );
  }
  try {
    const saved = await uploadUserFileFromBuffer({
      userId: session.user.id,
      fileName: downloadName,
      mimeType: "text/markdown; charset=utf-8",
      buffer: buf,
    });
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${downloadName}"`,
        "X-Saved-File-Id": saved.id,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка сохранения";
    return NextResponse.json(
      { error: msg, code: "EXPORT_SAVE_FAILED" },
      { status: 500 },
    );
  }
}
