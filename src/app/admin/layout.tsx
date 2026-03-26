import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

function AdminSidebarFallback() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 animate-pulse rounded-r-2xl border-r border-border bg-surface2" />
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<AdminSidebarFallback />}>
        <AdminSidebar />
      </Suspense>
      <div className="pl-64">
        <main className="min-h-screen p-6">{children}</main>
      </div>
    </div>
  );
}
