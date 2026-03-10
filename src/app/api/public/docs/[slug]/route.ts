import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const page = await prisma.docPage.findUnique({
    where: { slug: slug.toLowerCase() },
  });

  if (!page) {
    return NextResponse.json({ error: "Страница не найдена" }, { status: 404 });
  }

  return NextResponse.json(page);
}
