import { prisma } from "@/lib/prisma";
import { type SearchFilters, type SearchResult, SearchService } from "./search.interface";

export class PostgresSearchService extends SearchService {
  async search({ query, userId, fileType, folderId, dateFrom, dateTo }: SearchFilters): Promise<SearchResult> {
    const where: Record<string, unknown> = { userId, deletedAt: null };
    if (folderId) where.folderId = folderId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, Date>).gte = dateFrom;
      if (dateTo) (where.createdAt as Record<string, Date>).lte = dateTo;
    }
    if (fileType) where.mimeType = { contains: fileType };
    if (query?.trim()) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" as const } },
        // MVP: простой поиск по имени. Для полнотекстового — to_tsvector в raw SQL
      ];
    }

    const [files, folders, total] = await Promise.all([
      prisma.file.findMany({
        where: where as never,
        take: 50,
        select: { id: true, name: true, mimeType: true, size: true, folderId: true, createdAt: true },
      }),
      prisma.folder.findMany({
        where: { userId, deletedAt: null, ...(folderId ? { parentId: folderId } : {}) } as never,
        take: 20,
        select: { id: true, name: true, parentId: true, createdAt: true },
      }),
      prisma.file.count({ where: where as never }),
    ]);

    return {
      files,
      folders,
      total,
      hasMore: total > 50,
    };
  }

  async suggest(_query: string, _userId: string): Promise<string[]> {
    return [];
  }
}
