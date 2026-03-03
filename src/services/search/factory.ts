import type { SearchService } from "./search.interface";
import { PostgresSearchService } from "./postgres.search";
import { AiSearchService } from "./ai.search";

export class SearchFactory {
  static getService(): SearchService {
    const useAi = process.env.AI_SEARCH_ENABLED === "true";
    return useAi ? new AiSearchService() : new PostgresSearchService();
  }
}
