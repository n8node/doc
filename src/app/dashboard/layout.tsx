import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DashboardHeaderWidgets } from "@/components/layout/DashboardHeaderWidgets";
import { NotificationBanner } from "@/components/dashboard/NotificationBanner";
import { FreePlanAccessGuard } from "@/components/layout/FreePlanAccessGuard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <DashboardShell
      title="Личный кабинет"
      subtitle="Управление файлами и настройками"
      headerWidgets={<DashboardHeaderWidgets />}
    >
      <FreePlanAccessGuard />
      <main className="min-h-[calc(100vh-4.5rem)] p-4 sm:p-6">
        <div className="mb-4">
          <NotificationBanner />
        </div>
        {children}
      </main>
    </DashboardShell>
  );
}
