import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { SupportWidget } from "./SupportWidget";
import { UserMenu } from "./UserMenu";
import { TokenUsageWidget } from "./TokenUsageWidget";
import { MarketplaceBalanceWidget } from "./MarketplaceBalanceWidget";
import { FreePlanTimerWidget } from "./FreePlanTimerWidget";

export async function DashboardHeaderWidgets() {
  const session = await getServerSession(authOptions);
  const initial = session?.user?.email?.[0]?.toUpperCase() ?? "?";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <>
      <div className="hidden md:flex">
        <MarketplaceBalanceWidget />
      </div>
      <div className="hidden md:flex">
        <TokenUsageWidget />
      </div>
      <div className="hidden md:flex">
        <FreePlanTimerWidget />
      </div>
      <NotificationsDropdown />
      <SupportWidget />
      <ThemeToggle />
      <UserMenu
        initial={initial}
        email={session?.user?.email}
        isAdmin={isAdmin}
      />
    </>
  );
}
