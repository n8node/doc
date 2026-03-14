import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LandingContent } from "@/lib/landing-content";
import { ArrowRight, Sparkles } from "lucide-react";

const BENEFIT_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  default: "bg-primary",
};

function renderTitle(title: string, highlight: string) {
  if (!highlight || !title.includes(highlight)) {
    return title;
  }
  const parts = title.split(highlight);
  return (
    <>
      {parts[0]}
      <span className="bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
        {highlight}
      </span>
      {parts[1]}
    </>
  );
}

export function LandingHero({ content }: { content: LandingContent }) {
  const showCtaPrimary = content.ctaPrimary.trim() && content.ctaPrimaryHref.trim();
  const showCtaSecondary = content.ctaSecondary.trim() && content.ctaSecondaryHref.trim();

  return (
    <section className="relative overflow-hidden bg-background px-4 py-16 sm:py-24 lg:py-32">
      <div className="container mx-auto max-w-4xl text-center">
        <p className="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          {content.tagline}
        </p>
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {renderTitle(content.heroTitle, content.heroTitleHighlight)}
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
          {content.heroDescription}
        </p>
        {(showCtaPrimary || showCtaSecondary) && (
          <div className="mb-10 flex flex-wrap justify-center gap-4">
            {showCtaPrimary && (
              <Link href={content.ctaPrimaryHref}>
                <Button size="lg" className="gap-2 shadow-lg">
                  {content.ctaPrimary}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {showCtaSecondary && (
              <Link href={content.ctaSecondaryHref}>
                <Button variant="outline" size="lg">
                  {content.ctaSecondary}
                </Button>
              </Link>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-6">
          {content.benefits.map((b, i) => (
            <span key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${BENEFIT_COLORS[b.color ?? "default"]}`}
              />
              {b.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
