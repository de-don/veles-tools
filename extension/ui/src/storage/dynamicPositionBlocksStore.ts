import { DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL } from '../lib/activeDealsPolling';
import { getObjectStore, openIndexedDb } from '../lib/indexedDb';
import type { DynamicBlockConfig } from '../types/positionConstraints';

const DB_NAME = 'veles-dynamic-position-blocks';
const DB_VERSION = 1;
const STORE_NAME = 'configs';
const RECORD_KEY = 'configs';
const MIN_BLOCK_VALUE = 1;
const MIN_TIMEOUT_SEC = 60;
const MIN_CHECK_PERIOD_SEC = 5;

interface DynamicBlockConfigsRecord {
  id: typeof RECORD_KEY;
  payload: Record<string, DynamicBlockConfig>;
  storedAt: number;
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

export const DEFAULT_DYNAMIC_BLOCK_CONFIG: Omit<DynamicBlockConfig, 'apiKeyId'> = {
  minPositionsBlock: 5,
  maxPositionsBlock: 40,
  timeoutBetweenChangesSec: 10 * 60,
  checkPeriodSec: DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  enabled: false,
  lastChangeAt: null,
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const sanitizeNumber = (value: unknown, fallback: number): number => {
  const numeric = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.trunc(numeric);
};

const normalizeConfig = (config: DynamicBlockConfig): DynamicBlockConfig => {
  const minBlock = clamp(
    sanitizeNumber(config.minPositionsBlock, DEFAULT_DYNAMIC_BLOCK_CONFIG.minPositionsBlock),
    MIN_BLOCK_VALUE,
    Number.MAX_SAFE_INTEGER,
  );
  const maxBlockCandidate = sanitizeNumber(config.maxPositionsBlock, DEFAULT_DYNAMIC_BLOCK_CONFIG.maxPositionsBlock);
  const maxBlock = Math.max(maxBlockCandidate, minBlock);
  const timeoutBetweenChangesSec = Math.max(
    sanitizeNumber(config.timeoutBetweenChangesSec, DEFAULT_DYNAMIC_BLOCK_CONFIG.timeoutBetweenChangesSec),
    MIN_TIMEOUT_SEC,
  );
  const checkPeriodSec = Math.max(
    sanitizeNumber(config.checkPeriodSec, DEFAULT_DYNAMIC_BLOCK_CONFIG.checkPeriodSec),
    MIN_CHECK_PERIOD_SEC,
  );
  const lastChangeAt =
    typeof config.lastChangeAt === 'number' && Number.isFinite(config.lastChangeAt)
      ? Math.max(0, Math.trunc(config.lastChangeAt))
      : null;

  return {
    apiKeyId: config.apiKeyId,
    minPositionsBlock: minBlock,
    maxPositionsBlock: maxBlock,
    timeoutBetweenChangesSec,
    checkPeriodSec,
    enabled: Boolean(config.enabled),
    lastChangeAt,
  };
};

export const normalizeDynamicBlockConfigs = (
  configs: Record<number, DynamicBlockConfig>,
): Record<number, DynamicBlockConfig> => {
  const normalizedEntries = Object.values(configs).map((config) => {
    const normalized = normalizeConfig(config);
    return [normalized.apiKeyId, normalized] as const;
  });

  return Object.fromEntries(normalizedEntries) as Record<number, DynamicBlockConfig>;
};

const parseStoredConfigs = (payload: Record<string, DynamicBlockConfig>): Record<number, DynamicBlockConfig> => {
  const result: Record<number, DynamicBlockConfig> = {};

  Object.entries(payload).forEach(([key, value]) => {
    const apiKeyId = Number(key);
    if (!(Number.isFinite(apiKeyId) && value) || typeof value !== 'object') {
      return;
    }

    const candidate = value as Partial<DynamicBlockConfig>;
    const normalized = normalizeConfig({
      apiKeyId,
      minPositionsBlock: candidate.minPositionsBlock ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.minPositionsBlock,
      maxPositionsBlock: candidate.maxPositionsBlock ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.maxPositionsBlock,
      timeoutBetweenChangesSec:
        candidate.timeoutBetweenChangesSec ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.timeoutBetweenChangesSec,
      checkPeriodSec: candidate.checkPeriodSec ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.checkPeriodSec,
      enabled: candidate.enabled ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.enabled,
      lastChangeAt: candidate.lastChangeAt ?? DEFAULT_DYNAMIC_BLOCK_CONFIG.lastChangeAt,
    });

    result[apiKeyId] = normalized;
  });

  return result;
};

export const readDynamicBlockConfigs = async (): Promise<Record<number, DynamicBlockConfig>> => {
  const store = await getObjectStore(databaseConfig, STORE_NAME, 'readonly');
  if (!store) {
    return {};
  }

  return await new Promise<Record<number, DynamicBlockConfig>>((resolve) => {
    const request = store.get(RECORD_KEY) as IDBRequest<DynamicBlockConfigsRecord | undefined>;

    request.onsuccess = () => {
      const record = request.result;
      if (!(record?.payload && typeof record.payload === 'object')) {
        resolve({});
        return;
      }
      resolve(parseStoredConfigs(record.payload));
    };

    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось прочитать dynamic-blocks из IndexedDB', request.error);
      resolve({});
    };
  });
};

export const persistDynamicBlockConfigs = async (
  configs: Record<number, DynamicBlockConfig>,
): Promise<Record<number, DynamicBlockConfig>> => {
  const normalizedRecord = normalizeDynamicBlockConfigs(configs);
  const payload: DynamicBlockConfigsRecord = {
    id: RECORD_KEY,
    payload: Object.fromEntries(
      Object.values(normalizedRecord).map((config) => [String(config.apiKeyId), config]),
    ) as Record<string, DynamicBlockConfig>,
    storedAt: Date.now(),
  };

  try {
    await openIndexedDb(databaseConfig);
  } catch (error) {
    console.warn('[Veles Tools] IndexedDB недоступна для динамических блокировок', error);
    return normalizedRecord;
  }

  const store = await getObjectStore(databaseConfig, STORE_NAME, 'readwrite');
  if (!store) {
    return normalizedRecord;
  }

  await new Promise<void>((resolve) => {
    const request = store.put(payload) as IDBRequest<IDBValidKey>;

    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[Veles Tools] Не удалось сохранить dynamic-blocks в IndexedDB', request.error);
      resolve();
    };
  });

  return normalizedRecord;
};

export const upsertDynamicBlockConfig = async (
  config: DynamicBlockConfig,
  prev: Record<number, DynamicBlockConfig>,
): Promise<Record<number, DynamicBlockConfig>> => {
  const next = { ...prev, [config.apiKeyId]: config };
  return await persistDynamicBlockConfigs(next);
};

export const deleteDynamicBlockConfig = async (
  apiKeyId: number,
  prev: Record<number, DynamicBlockConfig>,
): Promise<Record<number, DynamicBlockConfig>> => {
  const next = { ...prev };
  delete next[apiKeyId];
  return await persistDynamicBlockConfigs(next);
};

export const resolveConfigForApiKey = (
  apiKeyId: number,
  configs: Record<number, DynamicBlockConfig>,
): DynamicBlockConfig => {
  if (configs[apiKeyId]) {
    return configs[apiKeyId];
  }
  return {
    apiKeyId,
    ...DEFAULT_DYNAMIC_BLOCK_CONFIG,
  };
};
