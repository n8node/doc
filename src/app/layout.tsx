import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "sonner";
import { getBrandingConfig } from "@/lib/branding";
import { getSeoConfig } from "@/lib/seo";

export const dynamic = "force-dynamic";

const DEFAULT_TITLE = "Облачное хранилище с AI";
const DEFAULT_DESCRIPTION = "Dropbox-подобный сервис для РФ с поиском по документам";

export async function generateMetadata(): Promise<Metadata> {
  const [branding, seo] = await Promise.all([getBrandingConfig(), getSeoConfig()]);
  const favicon = branding.faviconUrl || "/favicon.ico";
  const title = seo.title || `${branding.siteName} — ${DEFAULT_TITLE}`;
  const description = seo.description || DEFAULT_DESCRIPTION;
  return {
    title,
    description,
    keywords: seo.keywords || undefined,
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            {children}
            <Toaster position="top-right" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
