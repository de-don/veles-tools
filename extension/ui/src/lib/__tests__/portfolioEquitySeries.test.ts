import { describe, expect, it } from 'vitest';
import {
  buildPortfolioEquitySeries,
  createEmptyPortfolioEquitySeries,
  thinTimedPointsFromEnd,
} from '../activeDealsHistory';

const _createSeries = (points: { time: number; value: number }[]) => {
  if (points.length === 0) {
    return createEmptyPortfolioEquitySeries();
  }
  return buildPortfolioEquitySeries(points);
};

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
