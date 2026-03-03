import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-16">
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            qoqon.ru
          </h1>
          <p className="text-lg text-muted-foreground">
            Облачное хранилище с AI-поиском по документам
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
