import type { RoadmapStepDTO } from "@/lib/roadmap";
import { roadmapUtcCalendarDayMs } from "@/lib/roadmap-date-format";

/** Ширина логической области (узлы и линии в 0…ROADMAP_VW — без отрицательных X, схема не «мельчает» при scale) */
export const ROADMAP_VW = 1000;
/**
 * Горизонтальные поля: подпись ~200px по центру узла → половина 100 + запас.
 * Узлы в [MARGIN, VW−MARGIN], дуги C укладываются в [0, VW] при CURVE_BULGE ≤ MARGIN.
 */
export const ROADMAP_MARGIN = 120;
const ROW_Y0 = 108;
/** Вертикальный шаг между «полосами» месяцев */
export const ROADMAP_ROW_DY = 228;
/**
 * Выпуклость U-образных поворотов (в тех же единицах, что и координаты).
 * Должна быть ≤ ROADMAP_MARGIN, иначе кривая выйдет за 0…ROADMAP_VW.
 */
const CURVE_BULGE = 118;

/** Половина ширины блока подписи под узлом (foreignObject), симметрично центру */
export const ROADMAP_LABEL_HALF_WIDTH = 112;

export type RoadmapLayoutPoint = { x: number; y: number; rowIndex: number };

export type SnakeLayout = {
  pathSteps: RoadmapStepDTO[];
  coords: RoadmapLayoutPoint[];
  rowCount: number;
  viewHeight: number;
};

function monthKey(d: Date | string): string {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Стабильная хронология: календарный день UTC → sortOrder → id */
export function compareRoadmapSteps(a: RoadmapStepDTO, b: RoadmapStepDTO): number {
  const da = roadmapUtcCalendarDayMs(a.targetDate);
  const db = roadmapUtcCalendarDayMs(b.targetDate);
  if (da !== db) return da - db;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id.localeCompare(b.id);
}

/**
 * Сортировка и группировка по календарным месяцам (UTC).
 * Порядок линии на схеме = строго по дате планирования, не по списку в админке.
 */
export function sortAndGroupByMonth(steps: RoadmapStepDTO[]): RoadmapStepDTO[][] {
  if (steps.length === 0) return [];

  const sorted = [...steps].sort(compareRoadmapSteps);

  const buckets = new Map<string, RoadmapStepDTO[]>();
  for (const s of sorted) {
    const key = monthKey(s.targetDate);
    const arr = buckets.get(key);
    if (arr) arr.push(s);
    else buckets.set(key, [s]);
  }

  const monthKeys = Array.from(buckets.keys()).sort();
  return monthKeys.map((k) => buckets.get(k)!);
}

export function buildSnakeLayout(steps: RoadmapStepDTO[]): SnakeLayout {
  if (steps.length === 0) {
    return { pathSteps: [], coords: [], rowCount: 0, viewHeight: 400 };
  }

  const groups = sortAndGroupByMonth(steps);
  const innerW = ROADMAP_VW - 2 * ROADMAP_MARGIN;
  const pathSteps: RoadmapStepDTO[] = [];
  const coords: RoadmapLayoutPoint[] = [];

  groups.forEach((group, rowIndex) => {
    const n = group.length;
    const y = ROW_Y0 + rowIndex * ROADMAP_ROW_DY;
    const isLtr = rowIndex % 2 === 0;

    for (let i = 0; i < n; i++) {
      const step = group[i];
      pathSteps.push(step);
      let x: number;
      if (n === 1) {
        x = ROADMAP_MARGIN + innerW / 2;
      } else if (isLtr) {
        x = ROADMAP_MARGIN + (i / (n - 1)) * innerW;
      } else {
        x = ROADMAP_MARGIN + innerW - (i / (n - 1)) * innerW;
      }
      coords.push({ x, y, rowIndex });
    }
  });

  const rowCount = groups.length;
  const lastY = ROW_Y0 + (rowCount - 1) * ROADMAP_ROW_DY;
  const viewHeight = lastY + 240;

  return { pathSteps, coords, rowCount, viewHeight };
}

/** Сегмент k соединяет coords[k] и coords[k+1] */
export function segmentPathD(k: number, coords: RoadmapLayoutPoint[]): string {
  const a = coords[k];
  const b = coords[k + 1];
  if (a.y === b.y) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const dx = Math.abs(a.x - b.x);
  if (dx < 1) {
    const x = a.x;
    const bulge = x >= ROADMAP_VW / 2 ? CURVE_BULGE : -CURVE_BULGE;
    return `M ${x} ${a.y} C ${x + bulge} ${a.y}, ${x + bulge} ${b.y}, ${x} ${b.y}`;
  }
  const midY = (a.y + b.y) / 2;
  return `M ${a.x} ${a.y} C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
}

export function segmentSolid(pathSteps: RoadmapStepDTO[], k: number): boolean {
  return pathSteps[k].completed && pathSteps[k + 1].completed;
}
