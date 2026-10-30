export type ModerationVerdict = 'OK' | 'DIET_FLAG' | 'PROHIBITED' | 'UNCERTAIN';

export interface ModerationResult {
  verdict: ModerationVerdict;
  dietFlags: string[];
  matched: string[];
  source: 'AI' | 'RULES';
  rationale?: string;
}

export interface ListingDraft {
  title: string;
  category: string;
  quantity: number;
  expiryDate?: string;
  description?: string;
  listingType?: 'SELL' | 'EXCHANGE' | 'FREE';
  price?: number;
  source: 'AI' | 'HEURISTIC';
}

export interface SearchFilters {
  query?: string;
  category?: string;
  maxPrice?: number;
  freeOnly?: boolean;
  expiresWithinHours?: number;
  radiusKm?: number;
}

export type AgentType = 'LISTING' | 'MODERATION' | 'DISCOVERY';

export class AiUnavailableError extends Error {
  constructor(message = 'AI service unavailable') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiQuotaError extends Error {
  constructor(message = 'Daily AI request limit reached') {
    super(message);
    this.name = 'AiQuotaError';
  }
}
