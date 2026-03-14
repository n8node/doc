import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/** GET - все темы (включая неактивные) */
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const themes = await prisma.supportTicketTheme.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(themes);
}

/** POST - создать тему */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  try {
    requireAdmin(session);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, slug, sortOrder, isActive } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const finalSlug =
    typeof slug === "string" && slug.trim()
      ? slug.trim().toLowerCase().replace(/\s+/g, "-")
      : name.trim().toLowerCase().replace(/\s+/g, "-");

  const existing = await prisma.supportTicketTheme.findFirst({
    where: { OR: [{ slug: finalSlug }, { name: name.trim() }] },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Theme with this name or slug already exists" },
      { status: 409 }
    );
  }

  const theme = await prisma.supportTicketTheme.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      isActive: isActive !== false,
    },
  });
  return NextResponse.json(theme);
}
