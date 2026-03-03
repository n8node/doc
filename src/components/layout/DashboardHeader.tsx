import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Bell } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";
import { UserMenu } from "./UserMenu";

export async function DashboardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const session = await getServerSession(authOptions);
  const initial = session?.user?.email?.[0]?.toUpperCase() ?? "?";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-4 border-b border-border bg-surface/95 px-6 backdrop-blur-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:block">
          <Input
            placeholder="Поиск..."
            className="w-64"
          />
        </div>
        <button
          type="button"
          className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-surface2 hover:text-foreground"
          aria-label="Уведомления"
        >
          <Bell className="h-5 w-5" />
        </button>
        <ThemeToggle />
        <UserMenu
          initial={initial}
          email={session?.user?.email}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
