import { PublicPageForm } from "@/components/admin/PublicPageForm";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminPagesEditPage({ params }: Props) {
  const { id } = await params;
  const page = await prisma.publicPage.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Редактирование: {page.title}</h1>
      <PublicPageForm page={page} isNew={false} />
    </div>
  );
}
