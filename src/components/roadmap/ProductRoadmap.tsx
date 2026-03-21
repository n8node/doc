import type { RoadmapStepDTO } from "@/lib/roadmap";
import { cn } from "@/lib/utils";

type Props = {
  steps: RoadmapStepDTO[];
};

const VW = 1000;
const MARGIN = 70;
const Y_TOP = 100;
const Y_BOT = 250;
const VIEW_H = 410;

function buildLayout(n: number) {
  if (n === 0) return { coords: [] as { x: number; y: number }[], topCount: 0 };
  const topCount = Math.ceil(n / 2);
  const bottomCount = n - topCount;
  const width = VW - 2 * MARGIN;
  const coords: { x: number; y: number }[] = [];
  for (let i = 0; i < topCount; i++) {
    const x = topCount === 1 ? MARGIN + width : MARGIN + (i / (topCount - 1)) * width;
    coords.push({ x, y: Y_TOP });
  }
  for (let j = 0; j < bottomCount; j++) {
    const x =
      bottomCount === 1 ? MARGIN + width : MARGIN + width - (j / (bottomCount - 1)) * width;
    coords.push({ x, y: Y_BOT });
  }
  return { coords, topCount };
}

function segmentPathD(topCount: number, k: number, coords: { x: number; y: number }[]) {
  const a = coords[k];
  const b = coords[k + 1];
  if (k === topCount - 1) {
    const midY = (Y_TOP + Y_BOT) / 2;
    const bulge = 115;
    return `M ${a.x} ${Y_TOP} Q ${a.x + bulge} ${midY} ${b.x} ${Y_BOT}`;
  }
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function segmentSolid(steps: RoadmapStepDTO[], k: number) {
  return steps[k].completed && steps[k + 1].completed;
}

export function ProductRoadmap({ steps }: Props) {
  const n = steps.length;
  if (n === 0) {
    return (
      <p className="text-center text-muted-foreground">
        Этапы дорожной карты пока не добавлены.
      </p>
    );
  }

  const { coords, topCount } = buildLayout(n);

  return (
    <div className="w-full">
      <div className="hidden md:block">
        <svg
          viewBox={`0 0 ${VW} ${VIEW_H}`}
          className="h-auto w-full text-primary"
          role="img"
          aria-label="Дорожная карта продукта"
        >
          <title>Дорожная карта продукта</title>
          {n > 1 &&
            Array.from({ length: n - 1 }, (_, k) => {
              const solid = segmentSolid(steps, k);
              const d = segmentPathD(topCount, k, coords);
              return (
                <path
                  key={`seg-${k}`}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={solid ? undefined : "10 8"}
                  className={cn(!solid && "opacity-90")}
                />
              );
            })}
          {coords.map((c, i) => {
            const done = steps[i].completed;
            return (
              <g key={steps[i].id}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={9}
                  className="fill-background stroke-current"
                  strokeWidth={2.5}
                />
                {done ? (
                  <circle cx={c.x} cy={c.y} r={4} className="fill-current opacity-80" />
                ) : null}
                <foreignObject
                  x={c.x - 95}
                  y={i < topCount ? 128 : 283}
                  width="190"
                  height="120"
                >
                  <div className="text-center font-sans text-[13px] leading-snug text-foreground">
                    <p className="font-medium">{steps[i].title}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{steps[i].dateLabel}</p>
                    {done ? (
                      <p className="mt-1 text-xs font-medium text-primary">Готово</p>
                    ) : null}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-0 md:hidden">
        {steps.map((s, i) => {
          const hasNext = i < n - 1;
          const solid = hasNext && segmentSolid(steps, i);
          return (
            <div key={s.id} className="flex gap-4">
              <div className="flex w-9 shrink-0 flex-col items-center pt-1">
                <span
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary bg-background",
                    s.completed && "bg-primary/25"
                  )}
                  aria-hidden
                />
                {hasNext && (
                  <div
                    className={cn("mt-1 min-h-[36px] w-0.5 flex-1 rounded-full", solid && "bg-primary")}
                    style={
                      solid
                        ? undefined
                        : {
                            background:
                              "repeating-linear-gradient(to bottom, hsl(var(--primary)) 0px, hsl(var(--primary)) 5px, transparent 5px, transparent 10px)",
                          }
                    }
                  />
                )}
              </div>
              <div className={cn("pb-8", !hasNext && "pb-0")}>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.dateLabel}</p>
                {s.completed && (
                  <p className="mt-1 text-xs font-medium text-primary">Готово</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
