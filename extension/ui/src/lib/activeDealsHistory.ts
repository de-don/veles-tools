import type { PortfolioEquitySeries } from './deprecatedFile';

export interface DealHistoryPoint {
  time: number;
  pnl: number;
  pnlPercent: number;
}

export type DealHistorySnapshot = Record<string, DealHistoryPoint[]>;
export type DealHistoryMap = Map<number, DealHistoryPoint[]>;

export const DEAL_HISTORY_LIMIT = Number.POSITIVE_INFINITY;
export const DEAL_HISTORY_WINDOW_MS = 0;
export const PORTFOLIO_EQUITY_POINT_LIMIT = Number.POSITIVE_INFINITY;

export const filterDealHistoryByTimeWindow = (
  points: readonly DealHistoryPoint[],
  windowMs: number,
  now: number,
): DealHistoryPoint[] => {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return [...points];
  }
  const threshold = now - windowMs;
  return points.filter((point) => point.time >= threshold);
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const isDealHistoryPoint = (value: unknown): value is DealHistoryPoint => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { time?: unknown; pnl?: unknown; pnlPercent?: unknown };
  return isFiniteNumber(candidate.time) && isFiniteNumber(candidate.pnl) && isFiniteNumber(candidate.pnlPercent);
};

export const isDealHistorySnapshot = (value: unknown): value is DealHistorySnapshot => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.values(record).every((entry) => Array.isArray(entry) && entry.every(isDealHistoryPoint));
};

export const clampDealHistory = (
  points: DealHistoryPoint[],
  limit: number = DEAL_HISTORY_LIMIT,
): DealHistoryPoint[] => {
  void limit;
  return [...points];
};

export const snapshotHistoryToMap = (snapshot: DealHistorySnapshot | undefined): DealHistoryMap => {
  const map: DealHistoryMap = new Map();
  if (!snapshot) {
    return map;
  }
  for (const [key, entries] of Object.entries(snapshot)) {
    const numericKey = Number(key);
    if (!Number.isInteger(numericKey)) {
      continue;
    }
    const validEntries = entries.filter(isDealHistoryPoint);
    if (validEntries.length > 0) {
      map.set(numericKey, [...validEntries]);
    }
  }
  return map;
};

export const createEmptyPortfolioEquitySeries = (): PortfolioEquitySeries => ({
  points: [],
  minValue: 0,
  maxValue: 0,
});

export const sortPortfolioEquityPoints = (points: PortfolioEquitySeries['points']): PortfolioEquitySeries['points'] => {
  if (points.length <= 1) {
    return points;
  }
  return [...points].sort((left, right) => left.time - right.time);
};

export const thinTimedPointsFromEnd = <T extends { time: number }>(points: readonly T[], limit: number): T[] => {
  const sorted = [...points].sort((left, right) => left.time - right.time);
  if (!Number.isFinite(limit) || limit <= 0 || sorted.length <= limit) {
    return sorted;
  }

  const next = [...sorted];
  let index = next.length - 1;
  let shouldDrop = true;

  while (next.length > limit && index >= 0) {
    if (shouldDrop) {
      next.splice(index, 1);
    }
    shouldDrop = !shouldDrop;
    index -= 1;
  }

  return next;
};

export const buildPortfolioEquitySeries = (points: PortfolioEquitySeries['points']): PortfolioEquitySeries => {
  const sorted = sortPortfolioEquityPoints(points);
  if (sorted.length === 0) {
    return createEmptyPortfolioEquitySeries();
  }
  const values = sorted.map((point) => point.value);
  return {
    points: sorted,
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
  };
};

export const trimPortfolioEquitySeries = (series: PortfolioEquitySeries, maxPoints: number): PortfolioEquitySeries => {
  const trimmedPoints = thinTimedPointsFromEnd(series.points, maxPoints);
  return buildPortfolioEquitySeries(trimmedPoints);
};
