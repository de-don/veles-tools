import type { BacktestConfigDto, BacktestCycleDto, BacktestStatisticsDto } from '../api/backtests.dtos';
import type { IndexedDbConfig } from '../lib/indexedDb';
import { deleteIndexedDb, getObjectStore, openIndexedDb } from '../lib/indexedDb';
import { mapDetailFromDto, mapStatisticsFromDto } from '../services/backtests.mappers';
import type { BacktestDetail, BacktestStatistics } from '../types/backtests';

const DB_NAME = 'veles-backtests-cache';
const DB_VERSION = 3;

const DETAILS_STORE_NAME = 'backtest-details';
const CYCLES_STORE_NAME = 'backtest-cycles';
const LIST_STORE_NAME = 'backtest-list';
const LIST_SORT_INDEX = 'sortTimestamp';

const databaseConfig: IndexedDbConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  upgrade: (database, event) => {
    if (!database.objectStoreNames.contains(DETAILS_STORE_NAME)) {
      database.createObjectStore(DETAILS_STORE_NAME, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(CYCLES_STORE_NAME)) {
      database.createObjectStore(CYCLES_STORE_NAME, { keyPath: 'key' });
    }
    if (!database.objectStoreNames.contains(LIST_STORE_NAME)) {
      const listStore = database.createObjectStore(LIST_STORE_NAME, { keyPath: 'id' });
      listStore.createIndex(LIST_SORT_INDEX, LIST_SORT_INDEX, { unique: false });
    } else {
      const request = event?.target as IDBOpenDBRequest | null;
      const transaction = request?.transaction ?? null;
      if (transaction) {
        const listStore = transaction.objectStore(LIST_STORE_NAME);
        if (!listStore.indexNames.contains(LIST_SORT_INDEX)) {
          listStore.createIndex(LIST_SORT_INDEX, LIST_SORT_INDEX, { unique: false });
        }
      }
    }
  },
};

type CachedBacktestDetailRecord = {
  id: number;
  detail: BacktestDetail;
  storedAt: number;
};

type LegacyBacktestDetailRecord = {
  id: number;
  statistics?: BacktestStatisticsDto;
  config?: BacktestConfigDto | null;
  storedAt?: number;
};

interface NormalizedCyclesParams {
  from: string | null;
  to: string | null;
  pageSize: number;
}

type CachedBacktestCyclesRecord = {
  key: string;
  id: number;
  params: NormalizedCyclesParams;
  cycles: BacktestCycleDto[];
  storedAt: number;
};

type CachedBacktestListRecord = {
  id: number;
  snapshot: BacktestStatistics;
  storedAt: number;
  sortTimestamp: number;
};

type LegacyBacktestListRecord = {
  id: number;
  snapshot: BacktestStatisticsDto;
  storedAt: number;
  sortTimestamp: number;
};

const detailMemoryStore = new Map<number, CachedBacktestDetailRecord>();
const cyclesMemoryStore = new Map<string, CachedBacktestCyclesRecord>();

type BacktestListEvent = { type: 'updated' | 'cleared' };

const listSubscriptions = new Set<(event: BacktestListEvent) => void>();

const notifyListSubscribers = (event: BacktestListEvent): void => {
  listSubscriptions.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('[Veles Tools] Ошибка в обработчике обновления списка бэктестов', error);
    }
  });
};

export const subscribeBacktestList = (listener: (event: BacktestListEvent) => void): (() => void) => {
  listSubscriptions.add(listener);
  return () => {
    listSubscriptions.delete(listener);
  };
};

const readDetailFromMemory = (id: number): CachedBacktestDetailRecord | null => {
  return detailMemoryStore.get(id) ?? null;
};

const upgradeLegacyRecord = (legacy: LegacyBacktestDetailRecord): CachedBacktestDetailRecord | null => {
  if (!(legacy.statistics && legacy.config)) {
    return null;
  }
  const detail = mapDetailFromDto(legacy.statistics, legacy.config);
  return {
    id: legacy.id,
    detail,
    storedAt: Number.isFinite(legacy.storedAt) ? Number(legacy.storedAt) : Date.now(),
  };
};

const normalizeDetailRecord = (
  raw: CachedBacktestDetailRecord | LegacyBacktestDetailRecord | undefined,
): CachedBacktestDetailRecord | null => {
  if (!raw) {
    return null;
  }

  if ('detail' in raw && raw.detail) {
    const storedAt = Number.isFinite(raw.storedAt) ? Number(raw.storedAt) : Date.now();
    return {
      id: raw.id,
      detail: raw.detail,
      storedAt,
    };
  }

  return upgradeLegacyRecord(raw);
};

const readDetailRecord = async (id: number): Promise<CachedBacktestDetailRecord | null> => {
  const memoryHit = readDetailFromMemory(id);
  if (memoryHit) {
    return memoryHit;
  }

  const store = await getObjectStore(databaseConfig, DETAILS_STORE_NAME, 'readonly');
  if (!store) {
    return readDetailFromMemory(id);
  }

  return new Promise<CachedBacktestDetailRecord | null>((resolve) => {
    const request = store.get(id) as IDBRequest<CachedBacktestDetailRecord | LegacyBacktestDetailRecord | undefined>;

    request.onsuccess = () => {
      const normalized = normalizeDetailRecord(request.result);
      if (normalized) {
        detailMemoryStore.set(id, normalized);
        resolve(normalized);
        return;
      }
      resolve(null);
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось прочитать кэш бэктеста', request.error);
      resolve(readDetailFromMemory(id));
    };
  });
};

const normalizeCycleParams = (params: {
  from?: string | null;
  to?: string | null;
  pageSize?: number;
}): NormalizedCyclesParams => {
  const pageSize = Number.isFinite(params.pageSize) ? Math.max(Number(params.pageSize), 1) : 1;
  const from = params.from ?? null;
  const to = params.to ?? null;
  return { from, to, pageSize };
};

const buildCyclesKey = (id: number, params: NormalizedCyclesParams): string => {
  const fromKey = params.from ? params.from.trim() : '';
  const toKey = params.to ? params.to.trim() : '';
  return `${id}::${fromKey}::${toKey}::${params.pageSize}`;
};

const readCyclesFromMemory = (key: string): BacktestCycleDto[] | null => {
  const cached = cyclesMemoryStore.get(key);
  return cached ? cached.cycles : null;
};

const normalizeListSnapshot = (snapshot: BacktestStatistics | BacktestStatisticsDto): BacktestStatistics => {
  if ('deposit' in snapshot) {
    return snapshot;
  }
  return mapStatisticsFromDto(snapshot);
};

export const readCachedBacktestDetail = async (id: number): Promise<BacktestDetail | null> => {
  if (!Number.isFinite(id)) {
    return null;
  }

  const record = await readDetailRecord(id);
  return record ? record.detail : null;
};

export const writeCachedBacktestDetail = async (id: number, detail: BacktestDetail): Promise<void> => {
  if (!Number.isFinite(id)) {
    return;
  }

  const record: CachedBacktestDetailRecord = {
    id,
    detail,
    storedAt: Date.now(),
  };

  detailMemoryStore.set(id, record);

  const store = await getObjectStore(databaseConfig, DETAILS_STORE_NAME, 'readwrite');
  if (!store) {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = store.put(record) as IDBRequest<IDBValidKey>;
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить кэш бэктеста', request.error);
      resolve();
    };
  });
};

export const readCachedBacktestCycles = async (
  id: number,
  params: { from?: string | null; to?: string | null; pageSize?: number } = {},
): Promise<BacktestCycleDto[] | null> => {
  if (!Number.isFinite(id)) {
    return null;
  }

  const normalized = normalizeCycleParams(params);
  const key = buildCyclesKey(id, normalized);

  const memoryHit = readCyclesFromMemory(key);
  if (memoryHit) {
    return memoryHit;
  }

  const store = await getObjectStore(databaseConfig, CYCLES_STORE_NAME, 'readonly');
  if (!store) {
    return readCyclesFromMemory(key);
  }

  return new Promise<BacktestCycleDto[] | null>((resolve) => {
    const request = store.get(key) as IDBRequest<CachedBacktestCyclesRecord | undefined>;

    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        cyclesMemoryStore.set(key, record);
        resolve(record.cycles);
        return;
      }
      resolve(null);
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось прочитать кэш циклов бэктеста', request.error);
      resolve(readCyclesFromMemory(key));
    };
  });
};

export const writeCachedBacktestCycles = async (
  id: number,
  params: { from?: string | null; to?: string | null; pageSize?: number } = {},
  cycles: BacktestCycleDto[],
): Promise<void> => {
  if (!Number.isFinite(id)) {
    return;
  }

  const normalized = normalizeCycleParams(params);
  const key = buildCyclesKey(id, normalized);

  const record: CachedBacktestCyclesRecord = {
    key,
    id,
    params: normalized,
    cycles,
    storedAt: Date.now(),
  };

  cyclesMemoryStore.set(key, record);

  const store = await getObjectStore(databaseConfig, CYCLES_STORE_NAME, 'readwrite');
  if (!store) {
    return;
  }

  await new Promise<void>((resolve) => {
    const request = store.put(record) as IDBRequest<IDBValidKey>;
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить кэш циклов бэктеста', request.error);
      resolve();
    };
  });
};

const resolveSortTimestamp = (snapshot: BacktestStatistics): number => {
  const candidates = [snapshot.date, snapshot.to, snapshot.from];
  for (const candidate of candidates) {
    if (candidate) {
      const timestamp = Date.parse(candidate);
      if (!Number.isNaN(timestamp)) {
        return timestamp;
      }
    }
  }
  return Date.now();
};

const readBacktestListStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore | null> => {
  return getObjectStore(databaseConfig, LIST_STORE_NAME, mode);
};

export const writeCachedBacktestListBatch = async (snapshots: BacktestStatistics[]): Promise<void> => {
  if (snapshots.length === 0) {
    return;
  }

  const store = await readBacktestListStore('readwrite');
  if (!store) {
    return;
  }

  const now = Date.now();
  const records = snapshots.map<CachedBacktestListRecord>((snapshot) => ({
    id: snapshot.id,
    snapshot,
    storedAt: now,
    sortTimestamp: resolveSortTimestamp(snapshot),
  }));

  await Promise.all(
    records.map(
      (record) =>
        new Promise<void>((resolve) => {
          const request = store.put(record) as IDBRequest<IDBValidKey>;
          request.onsuccess = () => resolve();
          request.onerror = () => {
            console.warn('[Veles Tools] Не удалось сохранить запись списка бэктестов', request.error);
            resolve();
          };
        }),
    ),
  );

  notifyListSubscribers({ type: 'updated' });
};

export const clearCachedBacktestList = async (): Promise<void> => {
  const store = await readBacktestListStore('readwrite');
  if (!store) {
    notifyListSubscribers({ type: 'cleared' });
    return;
  }

  await new Promise<void>((resolve) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось очистить список бэктестов', request.error);
      resolve();
    };
  });

  notifyListSubscribers({ type: 'cleared' });
};

export const readCachedBacktestList = async (): Promise<BacktestStatistics[]> => {
  const store = await readBacktestListStore('readonly');
  if (!store) {
    return [];
  }

  return new Promise<BacktestStatistics[]>((resolve) => {
    const results: BacktestStatistics[] = [];
    const index = store.index(LIST_SORT_INDEX);
    const request = index.openCursor(null, 'prev') as IDBRequest<IDBCursorWithValue | null>;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      const record = cursor.value as CachedBacktestListRecord | LegacyBacktestListRecord;
      results.push(normalizeListSnapshot(record.snapshot));
      cursor.continue();
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось прочитать список бэктестов', request.error);
      resolve(results);
    };
  });
};

export interface BacktestListSummary {
  total: number;
  oldest: BacktestStatistics | null;
}

export const readCachedBacktestListSummary = async (): Promise<BacktestListSummary> => {
  const store = await readBacktestListStore('readonly');
  if (!store) {
    return { total: 0, oldest: null };
  }

  const total = await new Promise<number>((resolve) => {
    const request = store.count();
    request.onsuccess = () => {
      resolve(request.result ?? 0);
    };
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось получить размер списка бэктестов', request.error);
      resolve(0);
    };
  });

  if (total === 0) {
    return { total, oldest: null };
  }

  const oldestSnapshot = await new Promise<BacktestStatistics | null>((resolve) => {
    const index = store.index(LIST_SORT_INDEX);
    const request = index.openCursor(null, 'next') as IDBRequest<IDBCursorWithValue | null>;

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(null);
        return;
      }
      const record = cursor.value as CachedBacktestListRecord | LegacyBacktestListRecord;
      resolve(normalizeListSnapshot(record.snapshot));
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось получить древнейший бэктест', request.error);
      resolve(null);
    };
  });

  return { total, oldest: oldestSnapshot };
};

export const readCachedBacktestIdSet = async (): Promise<Set<number>> => {
  const ids = new Set<number>();
  const store = await readBacktestListStore('readonly');
  if (!store) {
    return ids;
  }

  await new Promise<void>((resolve) => {
    const request = store.openKeyCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const key = Number(cursor.primaryKey);
      if (Number.isFinite(key)) {
        ids.add(key);
      }
      cursor.continue();
    };
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось перечислить идентификаторы бэктестов', request.error);
      resolve();
    };
  });

  return ids;
};

export const clearBacktestCache = async (): Promise<void> => {
  detailMemoryStore.clear();
  cyclesMemoryStore.clear();
  notifyListSubscribers({ type: 'cleared' });

  if (typeof window === 'undefined') {
    return;
  }

  await deleteIndexedDb(DB_NAME);

  try {
    await openIndexedDb(databaseConfig);
  } catch (error) {
    console.warn('[Veles Tools] Не удалось переинициализировать IndexedDB после очистки', error);
  }
};
