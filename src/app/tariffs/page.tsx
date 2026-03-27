import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { PlansPricingPublic } from "@/components/plans/PlansPricingPublic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Тарифы",
  description:
    "Тарифные планы qoqon.ru: хранилище, AI, RAG, календарь и почта для автоматизации, парсинг сайтов и другое. Цены подгружаются из актуальных данных.",
};

export default function TariffsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-12">
        <div className="container mx-auto max-w-7xl">
          <PlansPricingPublic headingLevel="h1" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
