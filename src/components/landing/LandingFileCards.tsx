import type { LandingContent } from "@/lib/landing-content";
import { getLandingAssetUrl } from "@/lib/landing-content";

export function LandingFileCards({ content }: { content: LandingContent }) {
  const { title, iconKeys } = content.documentFormats;
  const icons = iconKeys.filter(Boolean);

  return (
    <section className="px-4 py-12">
      <div className="container mx-auto max-w-5xl">
        <div
          className="rounded-2xl border border-border bg-[#F8FAFF]/80 px-6 py-8 shadow-lg shadow-foreground/5"
          style={{ backgroundColor: "#F8FAFF" }}
        >
          <h2 className="mb-6 text-center text-xl font-semibold text-foreground sm:text-2xl">
            {title || "Форматы документов"}
          </h2>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            {icons.map((iconKey, i) => (
              <div
                key={i}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-white shadow-md sm:h-20 sm:w-20"
              >
                <img
                  src={`${getLandingAssetUrl(iconKey)}?v=${Date.now()}`}
                  alt=""
                  className="h-10 w-10 object-contain sm:h-12 sm:w-12"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = "none";
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
