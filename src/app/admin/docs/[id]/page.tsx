import { DocsPageForm } from "@/components/admin/DocsPageForm";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AdminDocsEditPage({ params }: Props) {
  const { id } = await params;
  const page = await prisma.docPage.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Редактирование: {page.title}</h1>
      <DocsPageForm page={page} isNew={false} />
    </div>
  );
}
