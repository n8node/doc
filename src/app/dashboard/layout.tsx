import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarV2 } from "@/components/layout/SidebarV2";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { sidebarV2Enabled } from "@/lib/feature-flags";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      {sidebarV2Enabled ? <SidebarV2 /> : <Sidebar />}
      <div className="pl-72">
        <DashboardHeader
          title="Личный кабинет"
          subtitle="Управление файлами и настройками"
        />
        <main className="min-h-[calc(100vh-4.5rem)] p-6">
          <div className="mb-4">
            <NotificationBanner />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
