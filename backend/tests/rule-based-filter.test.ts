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

  it('rejects tobacco and drugs', () => {
    expect(ruleBasedModeration('Rokok 1 bungkus').verdict).toBe('PROHIBITED');
  });

  it('sends likely spoiled food to an admin instead of passing it', () => {
    for (const text of [
      'Nasi kotak, agak basi',
      'Roti sedikit berjamur',
      'Susu bau asam',
      'Leftover curry, smells sour',
      'Yogurt expired yesterday',
    ]) {
      const r = ruleBasedModeration(text);
      expect(r.verdict, text).toBe('UNCERTAIN');
      expect(r.rationale, text).toContain('possible spoilage');
    }
  });

  it('sends medicine to an admin', () => {
    expect(ruleBasedModeration('Obat batuk sisa 1 botol').verdict).toBe('UNCERTAIN');
  });

  it('keeps diet flags on listings sent to review', () => {
    const r = ruleBasedModeration('Udang goreng, sudah basi');
    expect(r.verdict).toBe('UNCERTAIN');
    expect(r.dietFlags).toContain('seafood');
  });

  it('does not treat dish names as spoilage', () => {
    expect(ruleBasedModeration('Sayur asam 2 porsi').verdict).toBe('OK');
    expect(ruleBasedModeration('Ayam asam manis').verdict).toBe('OK');
  });

  it('flags seafood and egg', () => {
    expect(ruleBasedModeration('Nasi goreng udang').dietFlags).toContain('seafood');
    expect(ruleBasedModeration('Martabak telur').dietFlags).toContain('egg');
  });
});
