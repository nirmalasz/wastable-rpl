import type { ModerationResult } from './types.js';

/**
 * Rule-based moderation. Runs before the LLM on every listing, and is the whole verdict when
 * the LLM is unavailable (Reliability NFR). Keyword lists include English and Indonesian terms.
 *
 * Three strengths, on purpose:
 *  - PROHIBITED: always rejected and counted as a violation, so only words that are never
 *    acceptable on a food marketplace belong here.
 *  - REVIEW: likely spoiled or not food. Words like "basi" also appear in harmless phrases
 *    ("tidak basi", "sayur asam"), so these hide the listing for an admin (UNCERTAIN) instead
 *    of rejecting it outright.
 *  - DIET: ingredient badges only.
 */
const PROHIBITED = [
  // alcohol
  'alcohol',
  'alkohol',
  'beer',
  'bir',
  'wine',
  'vodka',
  'whisky',
  'whiskey',
  'arak',
  'tuak',
  'soju',
  'ciu',
  // Not "anggur merah" (also red grapes), "rum" (rum-raisin flavour) or "sake" (English word):
  // a false match here rejects the listing and counts a violation. The model catches those.
  // tobacco and drugs
  'rokok',
  'cigarette',
  'cigarettes',
  'tembakau',
  'tobacco',
  'vape',
  'ganja',
  'marijuana',
  'narkoba',
];

const REVIEW: Record<string, string[]> = {
  'possible spoilage': [
    'basi',
    'busuk',
    'berjamur',
    'jamuran',
    'berlendir',
    'bau asam',
    'berbau',
    'bau tidak sedap',
    'tidak segar',
    'kurang segar',
    'kedaluwarsa',
    'kadaluarsa',
    'kadaluwarsa',
    'kedaluarsa',
    'lewat tanggal',
    'spoiled',
    'spoilt',
    'rotten',
    'moldy',
    'mouldy',
    'mold',
    'mould',
    'slimy',
    'expired',
    'sour smell',
    'smells sour',
    'smells off',
    'off smell',
    'gone bad',
    'gone off',
    'past its date',
  ],
  'possibly not food': ['obat', 'medicine', 'medication', 'suplemen', 'supplement'],
};

const DIET_KEYWORDS: Record<string, string[]> = {
  pork: ['pork', 'babi', 'bacon', 'ham', 'lard', 'char siu', 'samcan'],
  gluten: ['gluten', 'wheat', 'gandum', 'terigu', 'bread', 'roti', 'pasta', 'mie'],
  nuts: ['peanut', 'kacang', 'almond', 'cashew', 'mete'],
  dairy: ['milk', 'susu', 'cheese', 'keju', 'butter', 'mentega'],
  seafood: [
    'seafood',
    'udang',
    'shrimp',
    'prawn',
    'cumi',
    'squid',
    'kepiting',
    'crab',
    'kerang',
    'clam',
    'lobster',
    'ikan',
    'fish',
    'teri',
    'tuna',
    'salmon',
  ],
  egg: ['egg', 'eggs', 'telur', 'telor'],
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

  const reasons: string[] = [];
  for (const [reason, words] of Object.entries(REVIEW)) {
    const hits = words.filter((w) => containsWord(text, w));
    if (hits.length > 0) reasons.push(`${reason}: ${hits.join(', ')}`);
  }
  if (reasons.length > 0) {
    return {
      verdict: 'UNCERTAIN',
      dietFlags,
      matched,
      source: 'RULES',
      rationale: `Keyword check: ${reasons.join('; ')}`,
    };
  }

  return {
    verdict: dietFlags.length > 0 ? 'DIET_FLAG' : 'OK',
    dietFlags,
    matched,
    source: 'RULES',
  };
}
