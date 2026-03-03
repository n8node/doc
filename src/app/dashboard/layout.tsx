import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-72">
        <DashboardHeader
          title="Личный кабинет"
          subtitle="Управление файлами и настройками"
        />
        <main className="min-h-[calc(100vh-4.5rem)] p-6">{children}</main>
      </div>
    </div>
  );
}
