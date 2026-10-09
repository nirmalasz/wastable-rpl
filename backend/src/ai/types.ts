export type ModerationVerdict = 'OK' | 'DIET_FLAG' | 'PROHIBITED' | 'UNCERTAIN';

export interface ModerationResult {
  verdict: ModerationVerdict;
  dietFlags: string[];
  matched: string[];
  source: 'AI' | 'RULES';
}

export interface ListingDraft {
  title: string;
  category: string;
  quantity: number;
  expiryDate?: string;
  description?: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  maxPrice?: number;
  freeOnly?: boolean;
  expiresWithinHours?: number;
  radiusKm?: number;
}
