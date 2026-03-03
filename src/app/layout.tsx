import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

export const metadata: Metadata = {
  title: "qoqon.ru — Облачное хранилище с AI",
  description: "Dropbox-подобный сервис для РФ с поиском по документам",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
