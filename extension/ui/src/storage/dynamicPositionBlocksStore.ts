import { DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL } from '../lib/activeDealsPolling';
import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import type { DynamicBlockConfig } from '../types/positionConstraints';

const STORAGE_KEY = 'veles-dynamic-position-blocks-v1';
const MIN_BLOCK_VALUE = 1;
const MIN_TIMEOUT_SEC = 60;
const MIN_CHECK_PERIOD_SEC = 5;

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

export const readDynamicBlockConfigs = (): Record<number, DynamicBlockConfig> => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed);
    const result: Record<number, DynamicBlockConfig> = {};

    entries.forEach(([key, value]) => {
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
  } catch {
    return {};
  }
};

export const persistDynamicBlockConfigs = (
  configs: Record<number, DynamicBlockConfig>,
): Record<number, DynamicBlockConfig> => {
  const normalizedEntries = Object.values(configs).map((config) => {
    const normalized = normalizeConfig(config);
    return [normalized.apiKeyId, normalized] as const;
  });

  const normalizedRecord = Object.fromEntries(normalizedEntries) as Record<number, DynamicBlockConfig>;
  writeStorageValue(STORAGE_KEY, JSON.stringify(normalizedRecord));
  return normalizedRecord;
};

export const upsertDynamicBlockConfig = (
  config: DynamicBlockConfig,
  prev: Record<number, DynamicBlockConfig>,
): Record<number, DynamicBlockConfig> => {
  const next = { ...prev, [config.apiKeyId]: config };
  return persistDynamicBlockConfigs(next);
};

export const deleteDynamicBlockConfig = (
  apiKeyId: number,
  prev: Record<number, DynamicBlockConfig>,
): Record<number, DynamicBlockConfig> => {
  const next = { ...prev };
  delete next[apiKeyId];
  return persistDynamicBlockConfigs(next);
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
