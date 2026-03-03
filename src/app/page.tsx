import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <Card glass className="p-12">
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground">
              qoqon.ru
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Облачное хранилище с AI-поиском по документам
            </p>
            <div className="flex gap-4">
              <Link href="/login">
                <Button size="lg">Войти</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg">
                  Личный кабинет
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
