"use client";

/** Клиентский img для лендинга: onError нельзя передавать из Server Components */
export function LandingAssetImg({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        const el = e.target as HTMLImageElement;
        el.style.display = "none";
      }}
    />
  );
}
