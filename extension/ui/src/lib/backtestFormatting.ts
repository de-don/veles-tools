const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatAmount = (value: number | null, suffix?: string): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${numberFormatter.format(value)}${suffix ? ` ${suffix}` : ''}`;
};

export const formatPercent = (value: number | null): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${percentageFormatter.format(value)}%`;
};

export const formatLeverage = (value: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return `${numberFormatter.format(value)}x`;
};

export const formatDateRu = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return '—';
  }
  return new Date(timestamp).toLocaleDateString('ru-RU');
};

export const formatDurationMinutes = (value: number | null): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  const minutes = Math.floor(value / 60);
  if (minutes < 60) {
    return `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч`;
  }
  const days = Math.floor(hours / 24);
  return `${days} д`;
};

export const resolveDealCount = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
};
