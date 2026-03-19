import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBrandingConfig } from "@/lib/branding";
import { HeaderNav } from "./HeaderNav";

export async function Header() {
  const session = await getServerSession(authOptions);
  const branding = await getBrandingConfig();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface/95 shadow-soft backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-bold text-foreground transition-opacity hover:opacity-80"
        >
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="logo" className="h-7 w-7 rounded-md object-contain" />
          ) : null}
          <span className="truncate">{branding.siteName}</span>
        </Link>
        <HeaderNav session={session} />
      </div>
    </header>
  );
}
