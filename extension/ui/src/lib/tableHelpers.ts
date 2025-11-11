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
