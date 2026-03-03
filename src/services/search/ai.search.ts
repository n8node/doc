import { PostgresSearchService } from "./postgres.search";
import { type SearchFilters, type SearchResult, SearchService } from "./search.interface";

/**
 * AI-поиск с fallback на полнотекстовый
 */
export class AiSearchService extends SearchService {
  private postgres = new PostgresSearchService();

  async search(filters: SearchFilters): Promise<SearchResult> {
    const vectorEnabled = process.env.AI_VECTOR_STORE_ENABLED === "true";
    if (!vectorEnabled) {
      return this.postgres.search(filters);
    }
    // TODO: semantic embedding + pgvector cosine similarity
    return this.postgres.search(filters);
  }

  async suggest(query: string, userId: string): Promise<string[]> {
    return this.postgres.suggest(query, userId);
  }
}
