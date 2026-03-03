import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "qoqon.ru — Облачное хранилище с AI",
  description: "Dropbox-подобный сервис для РФ с поиском по документам",
};

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
