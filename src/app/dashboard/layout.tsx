import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { DashboardTopbar } from "@/components/layout/DashboardTopbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardSidebar />
      <div className="pl-60">
        <DashboardTopbar
          title="Личный кабинет"
          subtitle="Управление файлами и настройками"
        />
        <main className="min-h-[calc(100vh-3.5rem)] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
