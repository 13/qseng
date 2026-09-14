import { describe, expect, it } from 'vitest';
import { formatPartialDate, isEmptyPartialDate, parsePartialDate } from './partial-date';

describe('parsePartialDate', () => {
  it('parses year, month.year and day.month.year with optional ~', () => {
    expect(parsePartialDate('1923')).toEqual({ year: 1923 });
    expect(parsePartialDate('06.1923')).toEqual({ year: 1923, month: 6 });
    expect(parsePartialDate('12.06.1923')).toEqual({ year: 1923, month: 6, day: 12 });
    expect(parsePartialDate('~ 1923')).toEqual({ year: 1923, approx: true });
  });
  it('returns null for empty and undefined for invalid input', () => {
    expect(parsePartialDate('')).toBeNull();
    expect(parsePartialDate('   ')).toBeNull();
    expect(parsePartialDate('31.02.1923')).toBeUndefined();
    expect(parsePartialDate('abc')).toBeUndefined();
    expect(parsePartialDate('13.1923')).toBeUndefined();
  });
});

describe('formatPartialDate', () => {
  it('formats to the canonical DD.MM.YYYY form', () => {
    expect(formatPartialDate({ year: 1923 })).toBe('1923');
    expect(formatPartialDate({ year: 1923, month: 6 })).toBe('06.1923');
    expect(formatPartialDate({ year: 1923, month: 6, day: 2, approx: true })).toBe('~02.06.1923');
    expect(formatPartialDate(null)).toBe('');
    expect(formatPartialDate({ month: 6 })).toBe('');
  });
  it('isEmptyPartialDate', () => {
    expect(isEmptyPartialDate(null)).toBe(true);
    expect(isEmptyPartialDate({ year: null })).toBe(true);
    expect(isEmptyPartialDate({ year: 1900 })).toBe(false);
  });
});
