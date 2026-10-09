import type { ListingDraft } from '../types.js';

/**
 * Listing Agent (FR-15): turns free text and/or a photo into a structured listing draft.
 * TODO: call Gemini with a JSON schema via the orchestrator.
 */
export async function extractListingDraft(input: {
  text?: string;
  photoUrl?: string;
}): Promise<ListingDraft> {
  throw new Error(`Listing Agent not implemented (input: ${JSON.stringify(input)})`);
}
