import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pages = await prisma.docPage.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });

  return NextResponse.json(pages);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase().replace(/\s+/g, "-") : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;

  if (!slug || !title) {
    return NextResponse.json(
      { error: "Укажите slug и title" },
      { status: 400 }
    );
  }

  const existing = await prisma.docPage.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Страница с таким slug уже существует" }, { status: 409 });
  }

  const page = await prisma.docPage.create({
    data: { slug, title, content, sortOrder },
  });

  return NextResponse.json(page);
}
