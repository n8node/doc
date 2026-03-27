import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFileCards } from "@/components/landing/LandingFileCards";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { PlansPricingPublic } from "@/components/plans/PlansPricingPublic";
import { getLandingContent } from "@/lib/landing-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getLandingContent();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <LandingHero content={content} />
        <LandingFileCards content={content} />
        <LandingFeatures content={content} />
        <LandingHowItWorks content={content} />
        <section id="pricing" className="border-t border-border bg-surface2/50 px-4 py-16">
          <div className="container mx-auto max-w-7xl">
            <PlansPricingPublic headingLevel="h2" />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
