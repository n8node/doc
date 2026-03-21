import type { RoadmapStepDTO } from "@/lib/roadmap";

export const ROADMAP_VW = 1000;
/** Отступ слева/справа (текст не обрезается у краёв) */
export const ROADMAP_MARGIN = 115;
const ROW_Y0 = 95;
/** Вертикальный шаг между «полосами» месяцев */
export const ROADMAP_ROW_DY = 195;
/** Сглаженная дуга: смещение контрольных точек (больше = плавнее дуга) */
const CURVE_BULGE = 210;

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

/** Сортировка и группировка по месяцам; внутри месяца — по дате и sortOrder */
export function sortAndGroupByMonth(steps: RoadmapStepDTO[]): RoadmapStepDTO[][] {
  const sorted = [...steps].sort((a, b) => {
    const ta = new Date(a.targetDate).getTime();
    const tb = new Date(b.targetDate).getTime();
    if (ta !== tb) return ta - tb;
    return a.sortOrder - b.sortOrder;
  });

  const groups: RoadmapStepDTO[][] = [];
  let lastKey = "";
  for (const s of sorted) {
    const key = monthKey(s.targetDate);
    if (key !== lastKey || groups.length === 0) {
      groups.push([s]);
      lastKey = key;
    } else {
      groups[groups.length - 1].push(s);
    }
  }
  return groups;
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
  const viewHeight = lastY + 200;

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
