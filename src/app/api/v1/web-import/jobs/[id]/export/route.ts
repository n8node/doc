import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const pages = job.pages as unknown as WebImportPageRow[];
  const selected =
    pageId && pages.length
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
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="web-import-${id}.json"`,
      },
    });
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
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="web-import-${id}.md"`,
    },
  });
}
