import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { Document, Packer, Paragraph, TextRun } from "docx";

/**
 * GET /api/v1/files/[id]/transcript?format=txt|docx
 * Download transcript as plain text or DOCX.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format") || "txt";

  const file = await prisma.file.findFirst({
    where: { id, userId, deletedAt: null },
    select: { name: true, aiMetadata: true },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const metadata = file.aiMetadata as { transcriptText?: string } | null;
  const transcriptText = metadata?.transcriptText;

  if (!transcriptText || typeof transcriptText !== "string") {
    return NextResponse.json(
      { error: "Транскрипт не найден. Сначала выполните транскрибацию." },
      { status: 404 },
    );
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "transcript";

  if (format === "docx") {
    const paragraphs = transcriptText
      .split(/\r?\n/)
      .map((line) =>
        new Paragraph({
          children: [new TextRun(line || " ")],
        }),
      );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun(" ")] })],
        },
      ],
    });

    const buffer = Buffer.from(await Packer.toBuffer(doc));
    const filename = `${baseName}.docx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  // txt (default)
  const filename = `${baseName}.txt`;
  return new NextResponse(transcriptText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
