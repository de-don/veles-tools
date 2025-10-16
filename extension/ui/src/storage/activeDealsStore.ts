import { type DealHistorySnapshot, isDealHistorySnapshot } from '../lib/activeDealsHistory';
import { type ActiveDealsZoomPreset, isActiveDealsZoomPreset } from '../lib/activeDealsZoom';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import type { DataZoomRange } from '../lib/chartOptions';
import { readStorageValue, removeStorageValue, writeStorageValue } from '../lib/safeStorage';
import type { ActiveDeal } from '../types/activeDeals';

const STORAGE_KEY = 'veles-active-deals-state-v1';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isNullableNumber = (value: unknown): value is number | null => value === null || isFiniteNumber(value);

const isDataZoomRange = (value: unknown): value is DataZoomRange => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { start?: unknown; end?: unknown };
  const isValidBound = (bound: unknown) => bound === undefined || isFiniteNumber(bound);
  return isValidBound(candidate.start) && isValidBound(candidate.end);
};

const isPortfolioEquitySeries = (value: unknown): value is PortfolioEquitySeries => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    points?: unknown;
    minValue?: unknown;
    maxValue?: unknown;
  };
  if (!Array.isArray(candidate.points)) {
    return false;
  }
  if (typeof candidate.minValue !== 'number' || typeof candidate.maxValue !== 'number') {
    return false;
  }
  return candidate.points.every((point) => {
    if (point === null || typeof point !== 'object') {
      return false;
    }
    const record = point as { time?: unknown; value?: unknown };
    return typeof record.time === 'number' && typeof record.value === 'number';
  });
};

const isActiveDeal = (value: unknown): value is ActiveDeal => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const deal = value as {
    id?: unknown;
    createdAt?: unknown;
    orders?: unknown;
    botName?: unknown;
  };
  if (typeof deal.id !== 'number' || typeof deal.createdAt !== 'string') {
    return false;
  }
  if (!Array.isArray(deal.orders)) {
    return false;
  }
  return true;
};

const isActiveDealsArray = (value: unknown): value is ActiveDeal[] => {
  return Array.isArray(value) && value.every(isActiveDeal);
};

export interface ActiveDealsSnapshot {
  deals: ActiveDeal[];
  series: PortfolioEquitySeries;
  zoomRange?: DataZoomRange;
  zoomPreset?: ActiveDealsZoomPreset;
  lastUpdated: number | null;
  storedAt: number;
  positionHistory?: DealHistorySnapshot;
}

const isActiveDealsSnapshot = (value: unknown): value is ActiveDealsSnapshot => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const snapshot = value as {
    deals?: unknown;
    series?: unknown;
    zoomRange?: unknown;
    zoomPreset?: unknown;
    lastUpdated?: unknown;
    storedAt?: unknown;
    positionHistory?: unknown;
  };

  if (!isActiveDealsArray(snapshot.deals)) {
    return false;
  }
  if (!isPortfolioEquitySeries(snapshot.series)) {
    return false;
  }
  if (!isNullableNumber(snapshot.lastUpdated)) {
    return false;
  }
  if (!isFiniteNumber(snapshot.storedAt)) {
    return false;
  }
  if (snapshot.zoomRange !== undefined && !isDataZoomRange(snapshot.zoomRange)) {
    return false;
  }
  if (snapshot.zoomPreset !== undefined && !isActiveDealsZoomPreset(snapshot.zoomPreset)) {
    return false;
  }
  if (snapshot.positionHistory !== undefined && !isDealHistorySnapshot(snapshot.positionHistory)) {
    return false;
  }
  return true;
};

export const readActiveDealsSnapshot = (): ActiveDealsSnapshot | null => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isActiveDealsSnapshot(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('[Veles Tools] Не удалось разобрать сохранённое состояние активных сделок', error);
  }
  return null;
};

export const writeActiveDealsSnapshot = (snapshot: ActiveDealsSnapshot): void => {
  const payload: ActiveDealsSnapshot = {
    deals: snapshot.deals,
    series: snapshot.series,
    zoomRange: snapshot.zoomRange,
    zoomPreset: snapshot.zoomPreset,
    lastUpdated: snapshot.lastUpdated ?? null,
    storedAt: snapshot.storedAt,
    positionHistory: snapshot.positionHistory,
  };
  writeStorageValue(STORAGE_KEY, JSON.stringify(payload));
};

export const clearActiveDealsSnapshot = (): void => {
  removeStorageValue(STORAGE_KEY);
};
