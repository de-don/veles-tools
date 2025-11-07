import { describe, expect, it } from 'vitest';
import { calculateMaxDrawdown } from '../backtestAnalytics';

describe('calculateMaxDrawdown', () => {
  it('returns 0 for empty series', () => {
    expect(calculateMaxDrawdown([])).toBe(0);
  });

  it('returns 0 when equity never decreases', () => {
    expect(calculateMaxDrawdown([0, 5, 10, 20])).toBe(0);
  });

  it('detects drawdown after a single drop', () => {
    expect(calculateMaxDrawdown([0, 10, 4, 12])).toBe(6);
  });

  it('captures the largest peak-to-trough drop before a new high', () => {
    const series = [100, 120, 90, 80, 150, 130, 200, 140];
    // Largest drop is from 200 down to 140 => 60
    expect(calculateMaxDrawdown(series)).toBe(60);
  });

  it('handles negative values and resets peaks after recovery', () => {
    const series = [0, -20, -10, -40, -5, -50];
    // Peak stays at 0 until a new high appears, so max drop is 50.
    expect(calculateMaxDrawdown(series)).toBe(50);
  });
});
