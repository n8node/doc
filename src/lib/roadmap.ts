import { prisma } from "@/lib/prisma";
import { compareRoadmapSteps } from "@/lib/roadmap-layout";

export type RoadmapStepDTO = {
  id: string;
  title: string;
  targetDate: string;
  sortOrder: number;
  completed: boolean;
};

export async function getRoadmapSteps(): Promise<RoadmapStepDTO[]> {
  const rows = await prisma.roadmapStep.findMany({
    orderBy: [{ targetDate: "asc" }, { sortOrder: "asc" }],
  });
  const mapped = rows.map((r) => ({
    id: r.id,
    title: r.title,
    targetDate: r.targetDate.toISOString(),
    sortOrder: r.sortOrder,
    completed: r.completed,
  }));
  return [...mapped].sort(compareRoadmapSteps);
}
