const DEFAULT_ORIGIN = 'https://veles.finance';

const getStoredOrigin = (): string | null => {
  const candidate = (globalThis as Record<string, unknown> | undefined)?.__VELES_ACTIVE_ORIGIN;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('__VELES_ACTIVE_ORIGIN') : null;
      if (stored) {
        (globalThis as Record<string, unknown>).__VELES_ACTIVE_ORIGIN = stored;
        return stored;
      }
    } catch {
      // ignore storage issues
    }
    return null;
  }
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    const trimmed = candidate.trim().replace(/\/$/, '');
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
};

const getLocationOrigin = (): string | null => {
  try {
    const origin = globalThis?.location?.origin;
    if (typeof origin === 'string' && origin.trim().length > 0) {
      const trimmed = origin.trim().replace(/\/$/, '');
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }
  } catch {
    // ignore
  }
  return null;
};

export const getApiBaseUrl = (): string => {
  return getStoredOrigin() ?? getLocationOrigin() ?? DEFAULT_ORIGIN;
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};
