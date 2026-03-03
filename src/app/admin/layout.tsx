import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-muted/30 p-4">
        <h2 className="mb-4 font-semibold">Админ-панель</h2>
        <nav className="flex flex-col gap-2">
          <Link href="/admin/settings" className="rounded px-3 py-2 hover:bg-muted">
            Настройки
          </Link>
          <Link href="/admin/settings?tab=s3" className="rounded px-3 py-2 hover:bg-muted">
            S3
          </Link>
          <Link href="/admin/settings?tab=yookassa" className="rounded px-3 py-2 hover:bg-muted">
            ЮKassa
          </Link>
          <Link href="/admin/settings?tab=ai" className="rounded px-3 py-2 hover:bg-muted">
            AI-провайдеры
          </Link>
          <Link href="/admin/users" className="rounded px-3 py-2 hover:bg-muted">
            Пользователи
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
