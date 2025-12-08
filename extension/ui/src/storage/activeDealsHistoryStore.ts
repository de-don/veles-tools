import type { DealHistoryMap, DealHistorySnapshot } from '../lib/activeDealsHistory';
import {
  buildPortfolioEquitySeries,
  isDealHistorySnapshot,
  snapshotHistoryToMap,
  thinTimedPointsFromEnd,
} from '../lib/activeDealsHistory';
import type { PortfolioEquityPoint, PortfolioEquitySeries } from '../lib/deprecatedFile';
import { deleteIndexedDb, getObjectStore, openIndexedDb } from '../lib/indexedDb';

const DB_NAME = 'veles-active-deals-history';
const DB_VERSION = 1;
const STORE_NAME = 'history';
const RECORD_KEY = 'history';
const POINT_LIMIT = 10_000;

type GroupedSeriesSnapshot = Record<string, PortfolioEquitySeries['points']>;

interface StoredActiveDealsHistory {
  pnlSeries: PortfolioEquitySeries['points'];
  groupedSeries: GroupedSeriesSnapshot;
  positionHistory: DealHistorySnapshot;
}

interface ActiveDealsHistoryRecord {
  id: typeof RECORD_KEY;
  payload: StoredActiveDealsHistory;
  storedAt: number;
}

export interface ActiveDealsHistoryCache {
  pnlSeries: PortfolioEquitySeries;
  groupedSeries: Map<number, PortfolioEquitySeries>;
  positionHistory: DealHistoryMap;
}

const databaseConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  upgrade: (database: IDBDatabase) => {
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
};

const isPortfolioEquityPoint = (value: unknown): value is PortfolioEquityPoint => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { time?: unknown; value?: unknown };
  return (
    typeof candidate.time === 'number' &&
    Number.isFinite(candidate.time) &&
    typeof candidate.value === 'number' &&
    Number.isFinite(candidate.value)
  );
};

const isPortfolioEquitySeriesPoints = (value: unknown): value is PortfolioEquitySeries['points'] => {
  return Array.isArray(value) && value.every(isPortfolioEquityPoint);
};

const isGroupedSeriesSnapshot = (value: unknown): value is GroupedSeriesSnapshot => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(isPortfolioEquitySeriesPoints);
};

const isStoredActiveDealsHistory = (value: unknown): value is StoredActiveDealsHistory => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { pnlSeries?: unknown; groupedSeries?: unknown; positionHistory?: unknown };
  return (
    isPortfolioEquitySeriesPoints(candidate.pnlSeries) &&
    isGroupedSeriesSnapshot(candidate.groupedSeries) &&
    isDealHistorySnapshot(candidate.positionHistory)
  );
};

const normalizeEquitySeries = (points: PortfolioEquitySeries['points']): PortfolioEquitySeries => {
  return buildPortfolioEquitySeries(thinTimedPointsFromEnd(points, POINT_LIMIT));
};

const normalizeGroupedSeries = (snapshot: GroupedSeriesSnapshot): Map<number, PortfolioEquitySeries> => {
  const map = new Map<number, PortfolioEquitySeries>();
  Object.entries(snapshot).forEach(([rawId, points]) => {
    const apiKeyId = Number(rawId);
    if (!Number.isInteger(apiKeyId)) {
      return;
    }
    const series = normalizeEquitySeries(points);
    if (series.points.length > 0) {
      map.set(apiKeyId, series);
    }
  });
  return map;
};

const normalizePositionHistory = (snapshot: DealHistorySnapshot): DealHistoryMap => {
  const map = snapshotHistoryToMap(snapshot);
  const normalized: DealHistoryMap = new Map();
  map.forEach((history, dealId) => {
    const trimmed = thinTimedPointsFromEnd(history, POINT_LIMIT);
    if (trimmed.length > 0) {
      normalized.set(dealId, trimmed);
    }
  });
  return normalized;
};

const mapGroupedSeriesToSnapshot = (groupedSeries: Map<number, PortfolioEquitySeries>): GroupedSeriesSnapshot => {
  const snapshot: GroupedSeriesSnapshot = {};
  groupedSeries.forEach((series, apiKeyId) => {
    snapshot[String(apiKeyId)] = thinTimedPointsFromEnd(series.points, POINT_LIMIT).map((point) => ({ ...point }));
  });
  return snapshot;
};

const mapPositionHistoryToSnapshot = (history: DealHistoryMap): DealHistorySnapshot => {
  const snapshot: DealHistorySnapshot = {};
  history.forEach((entries, dealId) => {
    snapshot[String(dealId)] = thinTimedPointsFromEnd(entries, POINT_LIMIT).map((entry) => ({ ...entry }));
  });
  return snapshot;
};

export const readActiveDealsHistoryCache = async (): Promise<ActiveDealsHistoryCache | null> => {
  const store = await getObjectStore(databaseConfig, STORE_NAME, 'readonly');
  if (!store) {
    return null;
  }

  return await new Promise<ActiveDealsHistoryCache | null>((resolve) => {
    const request = store.get(RECORD_KEY) as IDBRequest<ActiveDealsHistoryRecord | undefined>;

    request.onsuccess = () => {
      const record = request.result;
      if (!(record && isStoredActiveDealsHistory(record.payload))) {
        resolve(null);
        return;
      }
      resolve({
        pnlSeries: normalizeEquitySeries(record.payload.pnlSeries),
        groupedSeries: normalizeGroupedSeries(record.payload.groupedSeries),
        positionHistory: normalizePositionHistory(record.payload.positionHistory),
      });
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось прочитать кэш истории активных сделок', request.error);
      resolve(null);
    };
  });
};

export const writeActiveDealsHistoryCache = async (cache: ActiveDealsHistoryCache): Promise<void> => {
  const payload: StoredActiveDealsHistory = {
    pnlSeries: thinTimedPointsFromEnd(cache.pnlSeries.points, POINT_LIMIT),
    groupedSeries: mapGroupedSeriesToSnapshot(cache.groupedSeries),
    positionHistory: mapPositionHistoryToSnapshot(cache.positionHistory),
  };

  try {
    await openIndexedDb(databaseConfig);
  } catch (error) {
    console.warn('[Veles Tools] IndexedDB недоступна для сохранения истории активных сделок', error);
    return;
  }

  const store = await getObjectStore(databaseConfig, STORE_NAME, 'readwrite');
  if (!store) {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = store.put({
      id: RECORD_KEY,
      payload,
      storedAt: Date.now(),
    } satisfies ActiveDealsHistoryRecord) as IDBRequest<IDBValidKey>;

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить кэш истории активных сделок', request.error);
      resolve();
    };
  });
};

export const clearActiveDealsHistoryCache = async (): Promise<void> => {
  try {
    await deleteIndexedDb(DB_NAME);
  } catch (error) {
    console.warn('[Veles Tools] Не удалось очистить кэш истории активных сделок', error);
  }
};
