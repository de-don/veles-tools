import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

const STORAGE_KEY = 'veles-request-delay-ms-v1';

export const DEFAULT_REQUEST_DELAY_MS = 500;

const sanitizeDelayValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_REQUEST_DELAY_MS;
  }

  const normalized = Math.round(value);
  return normalized >= 0 ? normalized : DEFAULT_REQUEST_DELAY_MS;
};

export const readRequestDelay = (): number | null => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return sanitizeDelayValue(parsed);
};

export const writeRequestDelay = (delayMs: number): number => {
  const sanitized = sanitizeDelayValue(delayMs);
  writeStorageValue(STORAGE_KEY, String(sanitized));
  return sanitized;
};

export const normalizeRequestDelay = (candidate: number): number => {
  return sanitizeDelayValue(candidate);
};
