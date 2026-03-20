import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeHttpUrl, SsrfBlockedError } from "@/lib/web-import/ssrf";

const MAX_BATCH = 80;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const mode = typeof b.mode === "string" ? b.mode : "";

  try {
    if (mode === "single" || mode === "crawl" || mode === "links_only") {
      const startUrl = typeof b.startUrl === "string" ? b.startUrl : "";
      if (!startUrl.trim()) {
        return NextResponse.json({ error: "Укажите URL" }, { status: 400 });
      }
      normalizeHttpUrl(startUrl);
    } else if (mode === "batch" || mode === "links_batch") {
      const urls = Array.isArray(b.urls) ? b.urls : [];
      if (urls.length === 0) {
        return NextResponse.json({ error: "Добавьте хотя бы один URL" }, { status: 400 });
      }
      for (const u of urls.slice(0, MAX_BATCH)) {
        if (typeof u === "string" && u.trim()) normalizeHttpUrl(u);
      }
    } else {
      return NextResponse.json(
        { error: "Режим: single | crawl | batch | links_only | links_batch" },
        { status: 400 },
      );
    }

    const job = await prisma.webImportJob.create({
      data: {
        userId: session.user.id,
        mode,
        status: "pending",
        input: body as object,
        pages: [],
      },
    });

    return NextResponse.json({ id: job.id });
  } catch (e) {
    if (e instanceof SsrfBlockedError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка" },
      { status: 400 },
    );
  }
}
