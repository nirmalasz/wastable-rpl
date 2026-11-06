import { describe, expect, it } from 'vitest';
import { humanize, rupiah, timeLeft, toLocalInput } from './format';

describe('rupiah', () => {
  it('uses Indonesian thousands separators', () => {
    expect(rupiah(8000)).toBe('Rp 8.000');
    expect(rupiah(1250000)).toBe('Rp 1.250.000');
    expect(rupiah(0)).toBe('Rp 0');
  });
});

describe('timeLeft', () => {
  const now = Date.parse('2026-11-06T09:00:00Z');
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString();

  it.each([
    [35, '35m left'],
    [130, '2h 10m left'],
    [60 * 24 + 60 * 3, '1d 3h left'],
  ])('%i minutes ahead -> %s', (minutes, expected) => {
    expect(timeLeft(at(minutes), now)).toBe(expected);
  });

  it('says expired at or after the deadline', () => {
    expect(timeLeft(at(0), now)).toBe('expired');
    expect(timeLeft(at(-5), now)).toBe('expired');
  });
});

describe('toLocalInput', () => {
  it('formats for <input type="datetime-local"> in the browser time zone', () => {
    const local = new Date(2026, 10, 6, 9, 5); // 6 Nov 2026, 09:05 local
    expect(toLocalInput(local.toISOString())).toBe('2026-11-06T09:05');
  });
});

describe('humanize', () => {
  it('turns enum-style values into readable words', () => {
    expect(humanize('cooked-meal')).toBe('cooked meal');
    expect(humanize('UNDER_REVIEW')).toBe('under review');
  });
});
