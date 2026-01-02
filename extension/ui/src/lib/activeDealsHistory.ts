import type { ExecutedOrderPoint, PortfolioEquitySeries } from './deprecatedFile';

export interface DealHistoryPoint {
  time: number;
  pnl: number;
  pnlPercent: number;
}

export type DealHistorySnapshot = Record<string, DealHistoryPoint[]>;
export type DealHistoryMap = Map<number, DealHistoryPoint[]>;

export type ExecutedOrdersSnapshot = Record<string, ExecutedOrderPoint[]>;
export type ExecutedOrdersHistoryMap = Map<number, ExecutedOrderPoint[]>;

export const DEAL_HISTORY_WINDOW_MS = 0;
export const ACTIVE_DEALS_HISTORY_POINT_LIMIT = 10_000;

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

const isExecutedOrderPoint = (value: unknown): value is ExecutedOrderPoint => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ExecutedOrderPoint>;
  return (
    isFiniteNumber(candidate.time) &&
    isFiniteNumber(candidate.price) &&
    isFiniteNumber(candidate.quantity) &&
    isFiniteNumber(candidate.dealId) &&
    isFiniteNumber(candidate.apiKeyId) &&
    typeof candidate.side === 'string' &&
    typeof candidate.pair === 'string' &&
    typeof candidate.botName === 'string' &&
    isFiniteNumber(candidate.botId) &&
    typeof candidate.algorithm === 'string' &&
    isFiniteNumber(candidate.positionVolume) &&
    typeof candidate.type === 'string'
  );
};

export const isExecutedOrdersSnapshot = (value: unknown): value is ExecutedOrdersSnapshot => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return Object.values(record).every((entry) => Array.isArray(entry) && entry.every(isExecutedOrderPoint));
};

export const snapshotExecutedOrdersToMap = (snapshot: ExecutedOrdersSnapshot | undefined): ExecutedOrdersHistoryMap => {
  const map: ExecutedOrdersHistoryMap = new Map();
  if (!snapshot) {
    return map;
  }
  Object.entries(snapshot).forEach(([key, rawOrders]) => {
    const dealId = Number(key);
    if (!(Number.isInteger(dealId) && Array.isArray(rawOrders))) {
      return;
    }
    const orders = rawOrders.filter(isExecutedOrderPoint);
    if (orders.length > 0) {
      map.set(dealId, [...orders]);
    }
  });
  return map;
};

export const mapExecutedOrdersToSnapshot = (history: ExecutedOrdersHistoryMap): ExecutedOrdersSnapshot => {
  const snapshot: ExecutedOrdersSnapshot = {};
  history.forEach((orders, dealId) => {
    snapshot[String(dealId)] = [...orders];
  });
  return snapshot;
};

const buildExecutedOrderKey = (order: ExecutedOrderPoint): string => {
  return [
    order.time,
    order.price,
    order.quantity,
    order.side,
    order.type,
    order.positionVolume,
    order.apiKeyId,
    order.dealId,
  ].join('|');
};

const trimExecutedOrders = (
  orders: readonly ExecutedOrderPoint[],
  startTimestamp: number | null,
  limit: number,
): ExecutedOrderPoint[] => {
  const filtered = typeof startTimestamp === 'number' ? orders.filter((order) => order.time >= startTimestamp) : orders;
  return thinTimedPointsFromEnd(filtered, limit);
};

export const mergeExecutedOrdersHistory = (
  current: ExecutedOrdersHistoryMap,
  incoming: ExecutedOrdersHistoryMap,
  startTimestamp: number | null,
  limit: number = ACTIVE_DEALS_HISTORY_POINT_LIMIT,
): ExecutedOrdersHistoryMap => {
  const next: ExecutedOrdersHistoryMap = new Map();

  const appendOrders = (dealId: number, orders: readonly ExecutedOrderPoint[]) => {
    const existing = next.get(dealId) ?? [];
    const keys = new Set(existing.map(buildExecutedOrderKey));

    orders.forEach((order) => {
      if (typeof startTimestamp === 'number' && order.time < startTimestamp) {
        return;
      }
      const key = buildExecutedOrderKey(order);
      if (keys.has(key)) {
        return;
      }
      existing.push(order);
      keys.add(key);
    });

    const trimmed = trimExecutedOrders(existing, startTimestamp, limit);
    if (trimmed.length > 0) {
      next.set(dealId, trimmed);
    }
  };

  current.forEach((orders, dealId) => void appendOrders(dealId, orders));
  incoming.forEach((orders, dealId) => void appendOrders(dealId, orders));

  return next;
};

export const getSeriesStartTimestamp = (series: PortfolioEquitySeries): number | null => {
  const firstPoint = series.points[0];
  if (!firstPoint) {
    return null;
  }
  return Number.isFinite(firstPoint.time) ? firstPoint.time : null;
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

export const compressTimedPoints = <T extends { time: number }>(points: readonly T[]): T[] => {
  const sorted = [...points].sort((left, right) => left.time - right.time);
  if (sorted.length <= 1) {
    return sorted;
  }
  return sorted.filter((_point, index) => index % 2 === 0);
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
