const DEFAULT_FALLBACK = Number.NEGATIVE_INFINITY;

export const resolveSortableNumber = (value: number | null | undefined, fallback = DEFAULT_FALLBACK): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return value;
};

export const buildNumberSorter = <T>(
  selector: (item: T) => number | null | undefined,
  fallback = DEFAULT_FALLBACK,
): ((a: T, b: T) => number) => {
  return (a: T, b: T) => {
    const aValue = resolveSortableNumber(selector(a), fallback);
    const bValue = resolveSortableNumber(selector(b), fallback);
    return aValue - bValue;
  };
};

export const buildStringSorter = <T>(selector: (item: T) => string | null | undefined): ((a: T, b: T) => number) => {
  return (a: T, b: T) => {
    const aValue = selector(a) ?? '';
    const bValue = selector(b) ?? '';
    return aValue.localeCompare(bValue, 'ru', { sensitivity: 'base' });
  };
};

export const buildDateSorter = <T>(selector: (item: T) => string | null | undefined): ((a: T, b: T) => number) => {
  return (a: T, b: T) => {
    const aDate = selector(a);
    const bDate = selector(b);
    const aTime = aDate ? Date.parse(aDate) : Number.NaN;
    const bTime = bDate ? Date.parse(bDate) : Number.NaN;
    const safeATime = Number.isNaN(aTime) ? Number.NEGATIVE_INFINITY : aTime;
    const safeBTime = Number.isNaN(bTime) ? Number.NEGATIVE_INFINITY : bTime;
    return safeATime - safeBTime;
  };
};

const dayFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatDurationDays = (value: number | null | undefined, suffix = 'д'): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${dayFormatter.format(value)} ${suffix}`;
};
