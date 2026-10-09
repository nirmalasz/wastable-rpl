import type { ModerationResult } from './types.js';

/**
 * Rule-based fallback used when the LLM is unavailable (Reliability NFR).
 * Keyword lists include English and Indonesian terms. Extend as needed.
 */
const PROHIBITED = [
  'alcohol',
  'alkohol',
  'beer',
  'bir',
  'wine',
  'vodka',
  'whisky',
  'arak',
  'tuak',
  'soju',
  'ciu',
];

const DIET_KEYWORDS: Record<string, string[]> = {
  pork: ['pork', 'babi', 'bacon', 'ham', 'lard', 'char siu', 'samcan'],
  gluten: ['gluten', 'wheat', 'gandum', 'terigu', 'bread', 'roti', 'pasta', 'mie'],
  nuts: ['peanut', 'kacang', 'almond', 'cashew', 'mete'],
  dairy: ['milk', 'susu', 'cheese', 'keju', 'butter', 'mentega'],
};

const containsWord = (text: string, word: string) =>
  new RegExp(`(^|[^\\p{L}])${word}($|[^\\p{L}])`, 'iu').test(text);

export function ruleBasedModeration(text: string): ModerationResult {
  const matchedProhibited = PROHIBITED.filter((w) => containsWord(text, w));
  if (matchedProhibited.length > 0) {
    return { verdict: 'PROHIBITED', dietFlags: [], matched: matchedProhibited, source: 'RULES' };
  }

  const dietFlags: string[] = [];
  const matched: string[] = [];
  for (const [flag, words] of Object.entries(DIET_KEYWORDS)) {
    const hits = words.filter((w) => containsWord(text, w));
    if (hits.length > 0) {
      dietFlags.push(flag);
      matched.push(...hits);
    }
  }
  return {
    verdict: dietFlags.length > 0 ? 'DIET_FLAG' : 'OK',
    dietFlags,
    matched,
    source: 'RULES',
  };
}
