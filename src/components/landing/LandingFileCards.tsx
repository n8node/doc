import type { LandingContent } from "@/lib/landing-content";
import { getLandingAssetUrl } from "@/lib/landing-content";
import { LandingAssetImg } from "@/components/landing/LandingAssetImg";

export function LandingFileCards({ content }: { content: LandingContent }) {
  const docFormats = content?.documentFormats;
  const title = typeof docFormats?.title === "string" ? docFormats.title : "Форматы документов";
  const subtitle = typeof docFormats?.subtitle === "string" ? docFormats.subtitle.trim() : "";
  const iconKeys = Array.isArray(docFormats?.iconKeys) ? docFormats.iconKeys : [];
  const icons = iconKeys.filter((k): k is string => typeof k === "string" && k.length > 0);

  return (
    <section className="px-4 pt-6 pb-12">
      <div className="container mx-auto max-w-5xl">
        <div
          className="rounded-2xl border border-border bg-[#F8FAFF]/80 px-6 py-8 shadow-lg shadow-foreground/5"
          style={{ backgroundColor: "#F8FAFF" }}
        >
          <h2 className="mb-6 text-center text-xl font-semibold text-foreground sm:text-2xl">
            {title}
          </h2>
          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            {icons.map((iconKey, i) => (
              <div
                key={i}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-white shadow-md sm:h-20 sm:w-20"
              >
                <LandingAssetImg
                  src={getLandingAssetUrl(iconKey)}
                  alt=""
                  className="h-10 w-10 object-contain sm:h-12 sm:w-12"
                />
              </div>
            ))}
          </div>
          {subtitle ? (
            <p className="mt-6 text-center text-sm text-muted-foreground sm:text-base">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
