import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/30 p-4">
        <h2 className="mb-4 font-semibold">Личный кабинет</h2>
        <nav className="flex flex-col gap-2">
          <Link href="/dashboard/files" className="rounded px-3 py-2 hover:bg-muted">
            Файлы
          </Link>
          <Link href="/dashboard/search" className="rounded px-3 py-2 hover:bg-muted">
            Поиск
          </Link>
          <Link href="/dashboard/settings" className="rounded px-3 py-2 hover:bg-muted">
            Настройки
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
