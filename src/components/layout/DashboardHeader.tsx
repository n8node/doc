import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { SupportWidget } from "./SupportWidget";
import { UserMenu } from "./UserMenu";
import { TokenUsageWidget } from "./TokenUsageWidget";
import { MarketplaceBalanceWidget } from "./MarketplaceBalanceWidget";
import { FreePlanTimerWidget } from "./FreePlanTimerWidget";

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
        <MarketplaceBalanceWidget />
        <TokenUsageWidget />
        <FreePlanTimerWidget />
        <NotificationsDropdown />
        <SupportWidget />
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
