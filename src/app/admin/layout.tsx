import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminTopbar } from "@/components/layout/AdminTopbar";

function AdminSidebarFallback() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 animate-pulse rounded-r-xl border-r border-slate-200/80 bg-slate-50" />
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
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<AdminSidebarFallback />}>
        <AdminSidebar />
      </Suspense>
      <div className="pl-60">
        <AdminTopbar />
        <main className="min-h-[calc(100vh-3.5rem)] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
