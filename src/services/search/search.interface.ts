export interface SearchFilters {
  userId: string;
  query?: string;
  fileType?: string;
  folderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  onlyShared?: boolean;
}

export interface SearchResult {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: bigint;
    folderId: string | null;
    createdAt: Date;
  }>;
  folders: Array<{
    id: string;
    name: string;
    parentId: string | null;
    createdAt: Date;
  }>;
  total: number;
  hasMore: boolean;
}

export abstract class SearchService {
  abstract search(filters: SearchFilters): Promise<SearchResult>;
  abstract suggest(query: string, userId: string): Promise<string[]>;
}
