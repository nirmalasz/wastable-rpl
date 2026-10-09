import { ruleBasedModeration } from '../rule-based-filter.js';
import type { ModerationResult } from '../types.js';

/**
 * Moderation Agent (FR-12, FR-16): flags diet ingredients and prohibited items.
 * The admin always makes the final decision on UNCERTAIN results.
 * TODO: call Gemini first; fall back to the rule-based filter on error or when no API key is set.
 */
export async function moderateListing(text: string): Promise<ModerationResult> {
  return ruleBasedModeration(text);
}
