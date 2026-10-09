import { describe, expect, it } from 'vitest';
import { ruleBasedModeration } from '../src/ai/rule-based-filter.js';

describe('ruleBasedModeration', () => {
  it('rejects prohibited items', () => {
    expect(ruleBasedModeration('2 botol bir dingin').verdict).toBe('PROHIBITED');
  });

  it('flags diet ingredients', () => {
    const r = ruleBasedModeration('Nasi goreng babi, masih hangat');
    expect(r.verdict).toBe('DIET_FLAG');
    expect(r.dietFlags).toContain('pork');
  });

  it('passes ordinary food', () => {
    expect(ruleBasedModeration('Sayur bayam 3 ikat').verdict).toBe('OK');
  });

  it('does not match words inside other words', () => {
    expect(ruleBasedModeration('Hamburger steak').dietFlags).not.toContain('pork');
  });
});
