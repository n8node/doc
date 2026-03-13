import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { getN8nGuideContent, setN8nGuideContent } from "@/lib/n8n-guide-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const content = await getN8nGuideContent();
  return NextResponse.json(content);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  await setN8nGuideContent({
    title: typeof body.title === "string" ? body.title : undefined,
    subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
    httpTabHtml: typeof body.httpTabHtml === "string" ? body.httpTabHtml : undefined,
    pgvectorTabHtml: typeof body.pgvectorTabHtml === "string" ? body.pgvectorTabHtml : undefined,
  });

  return NextResponse.json({ ok: true });
}
