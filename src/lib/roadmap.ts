import { prisma } from "@/lib/prisma";

export type RoadmapStepDTO = {
  id: string;
  title: string;
  dateLabel: string;
  sortOrder: number;
  completed: boolean;
};

export async function getRoadmapSteps(): Promise<RoadmapStepDTO[]> {
  const rows = await prisma.roadmapStep.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    dateLabel: r.dateLabel,
    sortOrder: r.sortOrder,
    completed: r.completed,
  }));
}
