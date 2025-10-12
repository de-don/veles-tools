import type { IndexedDbConfig } from '../lib/indexedDb';
import { deleteIndexedDb, getObjectStore, openIndexedDb } from '../lib/indexedDb';
import type { BacktestCycle, BacktestStatisticsDetail } from '../types/backtests';

const DB_NAME = 'veles-backtests-cache';
const DB_VERSION = 2;

const DETAILS_STORE_NAME = 'backtest-details';
const CYCLES_STORE_NAME = 'backtest-cycles';

const databaseConfig: IndexedDbConfig = {
  name: DB_NAME,
  version: DB_VERSION,
  upgrade: (database) => {
    if (!database.objectStoreNames.contains(DETAILS_STORE_NAME)) {
      database.createObjectStore(DETAILS_STORE_NAME, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(CYCLES_STORE_NAME)) {
      database.createObjectStore(CYCLES_STORE_NAME, { keyPath: 'key' });
    }
  },
};

type CachedBacktestDetailRecord = {
  id: number;
  detail: BacktestStatisticsDetail;
  storedAt: number;
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
  cycles: BacktestCycle[];
  storedAt: number;
};

const detailMemoryStore = new Map<number, CachedBacktestDetailRecord>();
const cyclesMemoryStore = new Map<string, CachedBacktestCyclesRecord>();

const readDetailFromMemory = (id: number): BacktestStatisticsDetail | null => {
  const cached = detailMemoryStore.get(id);
  return cached ? cached.detail : null;
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

const readCyclesFromMemory = (key: string): BacktestCycle[] | null => {
  const cached = cyclesMemoryStore.get(key);
  return cached ? cached.cycles : null;
};

export const readCachedBacktestDetail = async (id: number): Promise<BacktestStatisticsDetail | null> => {
  if (!Number.isFinite(id)) {
    return null;
  }

  const memoryHit = readDetailFromMemory(id);
  if (memoryHit) {
    return memoryHit;
  }

  const store = await getObjectStore(databaseConfig, DETAILS_STORE_NAME, 'readonly');
  if (!store) {
    return readDetailFromMemory(id);
  }

  return new Promise<BacktestStatisticsDetail | null>((resolve) => {
    const request = store.get(id) as IDBRequest<CachedBacktestDetailRecord | undefined>;

    request.onsuccess = () => {
      const record = request.result;
      if (record) {
        detailMemoryStore.set(id, record);
        resolve(record.detail);
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

export const writeCachedBacktestDetail = async (id: number, detail: BacktestStatisticsDetail): Promise<void> => {
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
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить кэш бэктеста', request.error);
      resolve();
    };
  });
};

export const readCachedBacktestCycles = async (
  id: number,
  params: { from?: string | null; to?: string | null; pageSize?: number } = {},
): Promise<BacktestCycle[] | null> => {
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

  return new Promise<BacktestCycle[] | null>((resolve) => {
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
  cycles: BacktestCycle[],
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
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить кэш циклов бэктеста', request.error);
      resolve();
    };
  });
};

export const clearBacktestCache = async (): Promise<void> => {
  detailMemoryStore.clear();
  cyclesMemoryStore.clear();

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
