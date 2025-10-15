import { readStorageValue, removeStorageValue, writeStorageValue } from '../lib/safeStorage';

export interface TableColumnPreferences {
  order: string[];
  hidden: string[];
}

const STORAGE_PREFIX = 'veles-tools.table-columns.v1.';

const buildStorageKey = (tableId: string): string => {
  return `${STORAGE_PREFIX}${tableId}`;
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

const isTableColumnPreferences = (value: unknown): value is TableColumnPreferences => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { order?: unknown; hidden?: unknown };
  return isStringArray(candidate.order) && isStringArray(candidate.hidden);
};

const sanitizePreferences = (preferences: TableColumnPreferences): TableColumnPreferences => {
  const uniqueOrder = Array.from(new Set(preferences.order.filter((key) => key.length > 0)));
  const uniqueHidden = Array.from(new Set(preferences.hidden.filter((key) => key.length > 0)));
  return {
    order: uniqueOrder,
    hidden: uniqueHidden,
  };
};

export const readTableColumnPreferences = (tableId: string): TableColumnPreferences | null => {
  const raw = readStorageValue(buildStorageKey(tableId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isTableColumnPreferences(parsed)) {
      return sanitizePreferences(parsed);
    }
  } catch (error) {
    console.warn('[Veles Tools] Не удалось разобрать настройки столбцов таблицы', error);
  }

  return null;
};

export const writeTableColumnPreferences = (
  tableId: string,
  preferences: TableColumnPreferences,
): TableColumnPreferences => {
  const sanitized = sanitizePreferences(preferences);
  writeStorageValue(buildStorageKey(tableId), JSON.stringify(sanitized));
  return sanitized;
};

export const clearTableColumnPreferences = (tableId: string): void => {
  removeStorageValue(buildStorageKey(tableId));
};

