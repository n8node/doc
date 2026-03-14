import type { LandingContent } from "@/lib/landing-content";

const CARD_COLORS: Record<string, string> = {
  red: "bg-red-500/90",
  blue: "bg-blue-500/90",
  green: "bg-emerald-500/90",
  default: "bg-primary/90",
};

function FileIcon({ color }: { color?: string }) {
  return (
    <div
      className={`h-12 w-12 shrink-0 rounded-lg ${CARD_COLORS[color ?? "default"]} flex items-center justify-center`}
    />
  );
}

export function LandingFileCards({ content }: { content: LandingContent }) {
  return (
    <section className="px-4 py-12">
      <div className="container mx-auto max-w-5xl">
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {content.fileCards.map((card, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface/95 px-6 py-4 shadow-lg shadow-foreground/5 transition-shadow hover:shadow-xl hover:shadow-foreground/10"
            >
              <FileIcon color={card.color} />
              <div>
                <p className="font-medium text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground">{card.size}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
