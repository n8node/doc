import Link from "next/link";
import type { LandingContent } from "@/lib/landing-content";
import { getLandingAssetUrl } from "@/lib/landing-content";

function FeatureIcon({ iconKey }: { iconKey?: string | null }) {
  const key = iconKey?.trim();
  if (key) {
    return (
      <img
        src={`${getLandingAssetUrl(key)}?v=${Date.now()}`}
        alt=""
        className="mb-4 h-10 w-10 object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div className="mb-4 h-10 w-10 rounded-lg bg-primary/20" />
  );
}

export function LandingFeatures({ content }: { content: LandingContent }) {
  if (!content.features?.length) return null;

  return (
    <section id="features" className="border-t border-border bg-surface2/50 px-4 py-16">
      <div className="container mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {content.featuresTitle}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.features.map((f) => (
            <Link
              key={f.id}
              href={f.href || "#"}
              className="group rounded-2xl border border-border bg-surface/95 p-6 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <FeatureIcon iconKey={f.iconKey} />
              <h3 className="mb-2 font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
