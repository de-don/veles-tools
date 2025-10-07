const DEFAULT_ORIGIN = 'https://veles.finance';

export const getApiBaseUrl = (): string => {
  if (typeof globalThis !== 'undefined') {
    const origin = globalThis?.location?.origin;
    if (typeof origin === 'string' && origin.trim().length > 0) {
      const trimmed = origin.replace(/\/$/, '');
      if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return DEFAULT_ORIGIN;
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
};
