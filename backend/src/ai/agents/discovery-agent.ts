import type { SearchFilters } from '../types.js';

/**
 * Discovery Agent (FR-17): converts a natural-language query into search filters.
 * TODO: call Gemini with a JSON schema; until then, pass the text through as a keyword query.
 */
export async function parseSearchQuery(text: string): Promise<SearchFilters> {
  return { query: text };
}
