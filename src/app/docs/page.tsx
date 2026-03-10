import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Документация",
  description: "Руководство пользователя — функции и инструкции",
};

export default async function DocsIndexPage() {
  const pages = await prisma.docPage.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Документация</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Руководство по функциям сервиса. Выберите раздел для просмотра.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        {pages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Разделов пока нет. Документация будет добавлена позже.
          </p>
        ) : (
          <ul className="space-y-2">
            {pages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/docs/${page.slug}`}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-background hover:bg-surface2/50 transition-colors"
                >
                  <span className="font-medium text-foreground">{page.title}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
