import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Публичные страницы",
  description: "Информационные страницы для пользователей",
};

export default async function PagesIndexPage() {
  const pages = await prisma.publicPage.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Публичные страницы</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Информационные страницы. Выберите раздел для просмотра.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        {pages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Страниц пока нет. Они появятся после добавления в админке.
          </p>
        ) : (
          <ul className="space-y-2">
            {pages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/pages/${page.slug}`}
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
