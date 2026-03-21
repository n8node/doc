import type { RoadmapStepDTO } from "@/lib/roadmap";
import { formatRoadmapDateRu } from "@/lib/roadmap-date-format";
import {
  ROADMAP_LABEL_HALF_WIDTH,
  ROADMAP_VW,
  buildSnakeLayout,
  segmentPathD,
  segmentSolid,
} from "@/lib/roadmap-layout";
import { cn } from "@/lib/utils";

type Props = {
  steps: RoadmapStepDTO[];
};

export function ProductRoadmap({ steps }: Props) {
  const n = steps.length;
  if (n === 0) {
    return (
      <p className="text-center text-muted-foreground">
        Этапы дорожной карты пока не добавлены.
      </p>
    );
  }

  const { pathSteps, coords, viewHeight } = buildSnakeLayout(steps);
  const m = pathSteps.length;
  const labelW = ROADMAP_LABEL_HALF_WIDTH * 2;

  return (
    <div className="w-full">
      <div className="hidden min-w-0 md:block">
        <svg
          viewBox={`0 0 ${ROADMAP_VW} ${viewHeight}`}
          className="h-auto w-full overflow-visible text-primary"
          role="img"
          aria-label="Дорожная карта продукта"
          preserveAspectRatio="xMidYMin meet"
        >
          <title>Дорожная карта продукта</title>
          {m > 1 &&
            Array.from({ length: m - 1 }, (_, k) => {
              const solid = segmentSolid(pathSteps, k);
              const d = segmentPathD(k, coords);
              return (
                <path
                  key={`seg-${pathSteps[k].id}-${pathSteps[k + 1].id}`}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={solid ? undefined : "14 10"}
                  className={cn(!solid && "opacity-90")}
                />
              );
            })}
          {coords.map((c, i) => {
            const done = pathSteps[i].completed;
            const labelY = c.y + 36;
            return (
              <g key={pathSteps[i].id}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={14}
                  className="fill-background stroke-current"
                  strokeWidth={3.5}
                />
                {done ? (
                  <circle cx={c.x} cy={c.y} r={6.5} className="fill-current opacity-80" />
                ) : null}
                <foreignObject
                  x={c.x - ROADMAP_LABEL_HALF_WIDTH}
                  y={labelY}
                  width={labelW}
                  height="160"
                >
                  <div className="box-border px-1 text-center font-sans leading-snug text-foreground">
                    <p className="text-[15px] font-semibold md:text-[16px]">{pathSteps[i].title}</p>
                    <p className="mt-2 text-sm text-primary md:text-[15px]">
                      {formatRoadmapDateRu(pathSteps[i].targetDate)}
                    </p>
                    {done ? (
                      <p className="mt-2 text-sm font-medium text-primary">Готово</p>
                    ) : null}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-0 md:hidden">
        {pathSteps.map((s, i) => {
          const hasNext = i < m - 1;
          const solid = hasNext && segmentSolid(pathSteps, i);
          return (
            <div key={s.id} className="flex gap-4">
              <div className="flex w-9 shrink-0 flex-col items-center pt-1">
                <span
                  className={cn(
                    "h-4 w-4 shrink-0 rounded-full border-[2.5px] border-primary bg-background",
                    s.completed && "bg-primary/25"
                  )}
                  aria-hidden
                />
                {hasNext && (
                  <div
                    className={cn("mt-1 min-h-[36px] w-1 flex-1 rounded-full", solid && "bg-primary")}
                    style={
                      solid
                        ? undefined
                        : {
                            background:
                              "repeating-linear-gradient(to bottom, hsl(var(--primary)) 0px, hsl(var(--primary)) 6px, transparent 6px, transparent 12px)",
                          }
                    }
                  />
                )}
              </div>
              <div className={cn("pb-8", !hasNext && "pb-0")}>
                <p className="text-base font-medium text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-primary">{formatRoadmapDateRu(s.targetDate)}</p>
                {s.completed && (
                  <p className="mt-1 text-sm font-medium text-primary">Готово</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
