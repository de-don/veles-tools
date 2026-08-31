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

const DAYS_IN_YEAR = 365;
const DAYS_IN_MONTH = 30;

/** Picks the Russian plural form: [1, 2-4, 5-0] — e.g. `['день', 'дня', 'дней']`. */
export const pluralizeRu = (count: number, forms: [string, string, string]): string => {
  const absolute = Math.abs(count) % 100;
  const remainder = absolute % 10;
  if (absolute > 10 && absolute < 20) {
    return forms[2];
  }
  if (remainder > 1 && remainder < 5) {
    return forms[1];
  }
  if (remainder === 1) {
    return forms[0];
  }
  return forms[2];
};

/**
 * Formats a day count as an approximate "N лет N месяцев N дней" period
 * (a year is counted as 365 days, a month as 30). Zero-valued parts are omitted.
 */
export const formatDaysAsPeriodRu = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '—';
  }

  const totalDays = Math.floor(value);
  const years = Math.floor(totalDays / DAYS_IN_YEAR);
  const months = Math.floor((totalDays - years * DAYS_IN_YEAR) / DAYS_IN_MONTH);
  const days = totalDays - years * DAYS_IN_YEAR - months * DAYS_IN_MONTH;

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${pluralizeRu(years, ['год', 'года', 'лет'])}`);
  }
  if (months > 0) {
    parts.push(`${months} ${pluralizeRu(months, ['месяц', 'месяца', 'месяцев'])}`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${days} ${pluralizeRu(days, ['день', 'дня', 'дней'])}`);
  }

  return parts.join(' ');
};
