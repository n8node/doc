import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await prisma.publicPage.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← На главную
        </Link>
        <Link
          href="/pages"
          className="text-sm font-medium text-foreground"
        >
          Публичные страницы
        </Link>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        {pages.length > 0 && (
          <aside className="shrink-0 md:w-56">
            <nav className="rounded-xl border border-border bg-surface2/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Разделы</p>
              <ul className="space-y-1">
                <li>
                  <Link
                    href="/pages"
                    className="block rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-surface2"
                  >
                    Все страницы
                  </Link>
                </li>
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/pages/${p.slug}`}
                      className="block rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-surface2"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
