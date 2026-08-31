import { describe, expect, it } from 'vitest';
import { formatDaysAsPeriodRu, pluralizeRu } from '../backtestFormatting';

describe('pluralizeRu', () => {
  it('picks the form by the last digits', () => {
    const forms: [string, string, string] = ['день', 'дня', 'дней'];
    expect(pluralizeRu(1, forms)).toBe('день');
    expect(pluralizeRu(3, forms)).toBe('дня');
    expect(pluralizeRu(5, forms)).toBe('дней');
    expect(pluralizeRu(11, forms)).toBe('дней');
    expect(pluralizeRu(21, forms)).toBe('день');
    expect(pluralizeRu(112, forms)).toBe('дней');
    expect(pluralizeRu(0, forms)).toBe('дней');
  });
});

describe('formatDaysAsPeriodRu', () => {
  it('splits a day count into years, months and days', () => {
    expect(formatDaysAsPeriodRu(4519)).toBe('12 лет 4 месяца 19 дней');
  });

  it('omits zero-valued parts', () => {
    expect(formatDaysAsPeriodRu(365)).toBe('1 год');
    expect(formatDaysAsPeriodRu(60)).toBe('2 месяца');
    expect(formatDaysAsPeriodRu(31)).toBe('1 месяц 1 день');
  });

  it('keeps days for an empty period', () => {
    expect(formatDaysAsPeriodRu(0)).toBe('0 дней');
  });

  it('returns a dash for invalid input', () => {
    expect(formatDaysAsPeriodRu(null)).toBe('—');
    expect(formatDaysAsPeriodRu(-5)).toBe('—');
    expect(formatDaysAsPeriodRu(Number.NaN)).toBe('—');
  });
});
