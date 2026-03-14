import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/** PATCH - обновить тему */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, slug, sortOrder, isActive } = body;

  const existing = await prisma.supportTicketTheme.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  const data: { name?: string; slug?: string; sortOrder?: number; isActive?: boolean } = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim();
  if (typeof slug === "string" && slug.trim())
    data.slug = slug.trim().toLowerCase().replace(/\s+/g, "-");
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;
  if (typeof isActive === "boolean") data.isActive = isActive;

  const theme = await prisma.supportTicketTheme.update({
    where: { id },
    data,
  });
  return NextResponse.json(theme);
}

/** DELETE - удалить тему (или деактивировать) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.supportTicketTheme.findUnique({
    where: { id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Theme not found" }, { status: 404 });
  }

  if (existing._count.tickets > 0) {
    await prisma.supportTicketTheme.update({
      where: { id },
      data: { isActive: false },
    });
  } else {
    await prisma.supportTicketTheme.delete({
      where: { id },
    });
  }
  return NextResponse.json({ ok: true });
}
