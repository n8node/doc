import type { LandingContent } from "@/lib/landing-content";
import { getLandingAssetUrl } from "@/lib/landing-content";

function StepIcon({ step, iconKey }: { step: { num: number }; iconKey?: string | null }) {
  const key = iconKey?.trim();
  if (key) {
    return (
      <img
        src={getLandingAssetUrl(key)}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20 text-lg font-bold text-primary">
      {step.num}
    </span>
  );
}

export function LandingHowItWorks({ content }: { content: LandingContent }) {
  if (!content.steps?.length) return null;

  return (
    <section id="how-it-works" className="px-4 py-16">
      <div className="container mx-auto max-w-5xl">
        <h2 className="mb-10 text-center text-2xl font-bold text-foreground sm:text-3xl">
          {content.stepsTitle}
        </h2>
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-center sm:gap-12">
          {content.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-4">
              <StepIcon step={s} iconKey={s.iconKey} />
              <div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
