import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ProductRoadmap } from "@/components/roadmap/ProductRoadmap";
import { getRoadmapSteps } from "@/lib/roadmap";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const steps = await getRoadmapSteps();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-background py-12 md:py-16">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Дорожная карта продукта
            </h1>
            <p className="mb-10 text-center text-muted-foreground">
              Планы развития и ключевые этапы — на одной схеме.
            </p>
            <div className="w-full">
              <ProductRoadmap steps={steps} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
