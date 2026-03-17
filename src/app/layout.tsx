import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { getBrandingConfig } from "@/lib/branding";
import { getSeoConfig } from "@/lib/seo";
import { getYandexMetrikaConfig } from "@/lib/yandex-metrika";
import { YandexMetrikaInjector } from "@/components/YandexMetrikaInjector";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const yandexMetrikaConfig = await getYandexMetrikaConfig();

  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <Toaster position="top-right" richColors />
            </TooltipProvider>
          </SessionProvider>
        </ThemeProvider>
        <YandexMetrikaInjector config={yandexMetrikaConfig} />
      </body>
    </html>
  );
}
