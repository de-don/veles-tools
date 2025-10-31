import { readStorageValue, writeStorageValue } from '../lib/safeStorage';
import type { BacktestGroup } from '../types/backtestGroups';

const STORAGE_KEY = 'veles-tools.backtest-groups.v1';

const isNumberArray = (value: unknown): value is number[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
};

const isBacktestGroup = (value: unknown): value is BacktestGroup => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<BacktestGroup>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    isNumberArray(candidate.backtestIds) &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.updatedAt === 'number' &&
    Number.isFinite(candidate.updatedAt)
  );
};

const sanitizeGroup = (group: BacktestGroup): BacktestGroup => {
  const uniqueIds = Array.from(
    new Set(group.backtestIds.filter((id) => typeof id === 'number' && Number.isFinite(id))),
  );
  uniqueIds.sort((a, b) => a - b);
  return {
    id: group.id,
    name: group.name.trim(),
    backtestIds: uniqueIds,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

export const readBacktestGroups = (): BacktestGroup[] => {
  const raw = readStorageValue(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const groups: BacktestGroup[] = [];
    parsed.forEach((item) => {
      if (isBacktestGroup(item)) {
        groups.push(sanitizeGroup(item));
      }
    });
    return groups;
  } catch (error) {
    console.warn('[Veles Tools] Не удалось прочитать список групп бэктестов', error);
    return [];
  }
};

export const writeBacktestGroups = (groups: BacktestGroup[]): void => {
  const safeGroups = groups.map(sanitizeGroup);
  const payload = JSON.stringify(safeGroups);
  writeStorageValue(STORAGE_KEY, payload);
};
