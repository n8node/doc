import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const page = await prisma.publicPage.findUnique({ where: { id } });
  if (!page) {
    return NextResponse.json({ error: "Страница не найдена" }, { status: 404 });
  }
  return NextResponse.json(page);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));

  const data: { slug?: string; title?: string; content?: string; sortOrder?: number } = {};

  if (typeof body.slug === "string") {
    const slug = body.slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug) {
      const existing = await prisma.publicPage.findFirst({
        where: { slug, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Страница с таким slug уже существует" }, { status: 409 });
      }
      data.slug = slug;
    }
  }
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.content === "string") data.content = body.content;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  const page = await prisma.publicPage.update({
    where: { id },
    data,
  });

  return NextResponse.json(page);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.publicPage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
