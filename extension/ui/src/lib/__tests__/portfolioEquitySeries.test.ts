import { describe, expect, it } from 'vitest';
import {
  buildPortfolioEquitySeries,
  createEmptyPortfolioEquitySeries,
  thinTimedPointsFromEnd,
  trimPortfolioEquitySeries,
} from '../activeDealsHistory';

const createSeries = (points: { time: number; value: number }[]) => {
  if (points.length === 0) {
    return createEmptyPortfolioEquitySeries();
  }
  return buildPortfolioEquitySeries(points);
};

describe('trimPortfolioEquitySeries', () => {
  it('sorts points and thins from the end when exceeding the limit', () => {
    const series = createSeries([
      { time: 1_700, value: 17 },
      { time: 1_000, value: 10 },
      { time: 2_000, value: 20 },
      { time: 3_000, value: 30 },
      { time: 4_000, value: 40 },
    ]);

    const trimmed = trimPortfolioEquitySeries(series, 3);

    expect(trimmed.points.map((point) => point.time)).toEqual([1_000, 1_700, 3_000]);
    expect(trimmed.minValue).toBe(10);
    expect(trimmed.maxValue).toBe(30);
  });

  it('keeps an empty series intact', () => {
    const series = createEmptyPortfolioEquitySeries();

    const trimmed = trimPortfolioEquitySeries(series, 1_000);

    expect(trimmed.points).toHaveLength(0);
    expect(trimmed.minValue).toBe(0);
    expect(trimmed.maxValue).toBe(0);
  });

  it('keeps shape and ordering even when limit is small', () => {
    const series = createSeries([
      { time: 100, value: 1 },
      { time: 200, value: 2 },
      { time: 300, value: 3 },
      { time: 400, value: 4 },
      { time: 500, value: 5 },
      { time: 600, value: 6 },
      { time: 700, value: 7 },
    ]);

    const trimmed = trimPortfolioEquitySeries(series, 4);

    expect(trimmed.points.map((point) => point.time)).toEqual([100, 200, 400, 600]);
    expect(trimmed.points[0]?.value).toBe(1);
    expect(trimmed.points[trimmed.points.length - 1]?.value).toBe(6);
  });
});

describe('thinTimedPointsFromEnd', () => {
  it('sorts before thinning', () => {
    const result = thinTimedPointsFromEnd(
      [
        { time: 30, value: 'c' },
        { time: 10, value: 'a' },
        { time: 20, value: 'b' },
      ],
      2,
    );

    expect(result.map((item) => item.value)).toEqual(['a', 'b']);
  });

  it('returns sorted copy when limit is generous', () => {
    const original = [
      { time: 3, value: 'c' },
      { time: 1, value: 'a' },
      { time: 2, value: 'b' },
    ];
    const result = thinTimedPointsFromEnd(original, 10);

    expect(result).not.toBe(original);
    expect(result.map((item) => item.value)).toEqual(['a', 'b', 'c']);
  });
});
