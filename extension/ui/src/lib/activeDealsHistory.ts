export interface DealHistoryPoint {
  time: number;
  pnl: number;
  pnlPercent: number;
}

export type DealHistorySnapshot = Record<string, DealHistoryPoint[]>;
export type DealHistoryMap = Map<number, DealHistoryPoint[]>;

export const DEAL_HISTORY_LIMIT = 180;

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

export const clampDealHistory = (points: DealHistoryPoint[], limit: number = DEAL_HISTORY_LIMIT): DealHistoryPoint[] => {
  if (points.length <= limit) {
    return points;
  }
  return points.slice(-limit);
};

export const mapHistoryToSnapshot = (history: DealHistoryMap, limit: number = DEAL_HISTORY_LIMIT): DealHistorySnapshot => {
  const snapshot: DealHistorySnapshot = {};
  history.forEach((points, key) => {
    const normalizedKey = String(key);
    snapshot[normalizedKey] = clampDealHistory([...points], limit);
  });
  return snapshot;
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
      map.set(numericKey, clampDealHistory(validEntries));
    }
  }
  return map;
};

