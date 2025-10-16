import type { ColumnsType, ColumnType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  readTableColumnPreferences,
  type TableColumnPreferences,
  writeTableColumnPreferences,
} from '../storage/tableColumnsPreferencesStore';

export type ColumnMoveDirection = 'up' | 'down';

export interface ColumnSettingsItem {
  key: string;
  title: string;
  visible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export interface UseTableColumnSettingsParams<RecordType extends object> {
  tableKey: string;
  columns: ColumnsType<RecordType>;
  minimumVisibleColumns?: number;
}

export interface UseTableColumnSettingsResult<RecordType extends object> {
  columns: ColumnsType<RecordType>;
  settings: ColumnSettingsItem[];
  moveColumn: (key: string, direction: ColumnMoveDirection) => void;
  setColumnVisibility: (key: string, visible: boolean) => void;
  reset: () => void;
  hasCustomSettings: boolean;
}

interface PreparedColumn<RecordType extends object> extends ColumnType<RecordType> {
  key: string;
}

const resolveColumnKey = <RecordType extends object>(column: ColumnType<RecordType>, index: number): string => {
  if (typeof column.key === 'string' && column.key.length > 0) {
    return column.key;
  }
  if (typeof column.key === 'number') {
    return String(column.key);
  }
  if (typeof column.dataIndex === 'string' && column.dataIndex.length > 0) {
    return column.dataIndex;
  }
  if (typeof column.dataIndex === 'number') {
    return String(column.dataIndex);
  }
  if (Array.isArray(column.dataIndex) && column.dataIndex.length > 0) {
    return column.dataIndex.map((part) => String(part)).join('.');
  }
  return `column_${index}`;
};

const createDefaultPreferences = (availableKeys: readonly string[]): TableColumnPreferences => {
  return {
    order: [...availableKeys],
    hidden: [],
  };
};

const areArraysEqual = (left: readonly string[], right: readonly string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
};

const arePreferencesEqual = (left: TableColumnPreferences, right: TableColumnPreferences): boolean => {
  return areArraysEqual(left.order, right.order) && areArraysEqual(left.hidden, right.hidden);
};

const sanitizePreferences = (
  preferences: TableColumnPreferences,
  availableKeys: readonly string[],
  minimumVisibleColumns: number,
): TableColumnPreferences => {
  if (availableKeys.length === 0) {
    return { order: [], hidden: [] };
  }

  const uniqueAvailableKeys = Array.from(new Set(availableKeys));

  const filteredOrder = preferences.order.filter((key) => uniqueAvailableKeys.includes(key));
  const missingKeys = uniqueAvailableKeys.filter((key) => !filteredOrder.includes(key));
  const order = [...filteredOrder, ...missingKeys];

  const filteredHidden = preferences.hidden.filter((key) => uniqueAvailableKeys.includes(key));
  const hiddenSet = new Set(filteredHidden);

  let visibleCount = order.reduce((count, key) => (hiddenSet.has(key) ? count : count + 1), 0);
  const requiredVisible = Math.max(1, minimumVisibleColumns);

  if (visibleCount < requiredVisible) {
    for (const key of order) {
      if (!hiddenSet.has(key)) {
        continue;
      }
      hiddenSet.delete(key);
      visibleCount += 1;
      if (visibleCount >= requiredVisible) {
        break;
      }
    }
  }

  return {
    order,
    hidden: Array.from(hiddenSet),
  };
};

const resolveColumnTitle = <RecordType extends object>(
  title: ColumnType<RecordType>['title'],
  fallbackKey: string,
): string => {
  if (typeof title === 'string' || typeof title === 'number') {
    return String(title);
  }
  return fallbackKey;
};

export const useTableColumnSettings = <RecordType extends object>(
  params: UseTableColumnSettingsParams<RecordType>,
): UseTableColumnSettingsResult<RecordType> => {
  const { tableKey, columns, minimumVisibleColumns = 1 } = params;

  const preparedColumns = useMemo<PreparedColumn<RecordType>[]>(
    () =>
      columns.map((column, index) => {
        const key = resolveColumnKey<RecordType>(column, index);
        return {
          ...column,
          key,
        };
      }),
    [columns],
  );

  const availableKeys = useMemo(() => preparedColumns.map((column) => column.key), [preparedColumns]);

  const [preferences, setPreferences] = useState<TableColumnPreferences>(() => {
    const stored = readTableColumnPreferences(tableKey);
    const base = stored ?? createDefaultPreferences(availableKeys);
    return sanitizePreferences(base, availableKeys, minimumVisibleColumns);
  });

  useEffect(() => {
    setPreferences((prev) => {
      const next = sanitizePreferences(prev, availableKeys, minimumVisibleColumns);
      return arePreferencesEqual(prev, next) ? prev : next;
    });
  }, [availableKeys, minimumVisibleColumns]);

  useEffect(() => {
    writeTableColumnPreferences(tableKey, preferences);
  }, [tableKey, preferences]);

  const columnsMap = useMemo(() => {
    const map = new Map<string, PreparedColumn<RecordType>>();
    preparedColumns.forEach((column) => {
      map.set(column.key, column);
    });
    return map;
  }, [preparedColumns]);

  const moveColumn = useCallback(
    (key: string, direction: ColumnMoveDirection) => {
      setPreferences((prev) => {
        const currentIndex = prev.order.indexOf(key);
        if (currentIndex === -1) {
          return prev;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= prev.order.length) {
          return prev;
        }

        const nextOrder = [...prev.order];
        nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, key);

        const nextPreferences = sanitizePreferences(
          { order: nextOrder, hidden: prev.hidden },
          availableKeys,
          minimumVisibleColumns,
        );

        return arePreferencesEqual(prev, nextPreferences) ? prev : nextPreferences;
      });
    },
    [availableKeys, minimumVisibleColumns],
  );

  const setColumnVisibility = useCallback(
    (key: string, visible: boolean) => {
      setPreferences((prev) => {
        const hiddenSet = new Set(prev.hidden);
        if (visible) {
          if (!hiddenSet.delete(key)) {
            return prev;
          }
        } else {
          hiddenSet.add(key);
        }

        const nextPreferences = sanitizePreferences(
          { order: prev.order, hidden: Array.from(hiddenSet) },
          availableKeys,
          minimumVisibleColumns,
        );

        return arePreferencesEqual(prev, nextPreferences) ? prev : nextPreferences;
      });
    },
    [availableKeys, minimumVisibleColumns],
  );

  const reset = useCallback(() => {
    setPreferences(createDefaultPreferences(availableKeys));
  }, [availableKeys]);

  const settings = useMemo<ColumnSettingsItem[]>(() => {
    const hiddenSet = new Set(preferences.hidden);
    return preferences.order
      .filter((key) => columnsMap.has(key))
      .map((key, index) => {
        const column = columnsMap.get(key);

        return {
          key,
          title: resolveColumnTitle<RecordType>(column?.title, key),
          visible: !hiddenSet.has(key),
          canMoveUp: index > 0,
          canMoveDown: index < preferences.order.length - 1,
        };
      });
  }, [preferences.order, preferences.hidden, columnsMap]);

  const visibleColumns = useMemo<ColumnsType<RecordType>>(() => {
    const hiddenSet = new Set(preferences.hidden);
    const orderedKeys = preferences.order.filter((key) => columnsMap.has(key) && !hiddenSet.has(key));
    const total = orderedKeys.length;

    return orderedKeys.map((key, index) => {
      // biome-ignore lint/style/noNonNullAssertion: 100% exists
      const column = columnsMap.get(key)!;

      if (column.fixed === 'left' && index !== 0) {
        return { ...column, fixed: undefined };
      }
      if (column.fixed === 'right' && index !== total - 1) {
        return { ...column, fixed: undefined };
      }
      return column;
    });
  }, [preferences.hidden, preferences.order, columnsMap]);

  const hasCustomSettings = useMemo(() => {
    if (!areArraysEqual(preferences.order, availableKeys)) {
      return true;
    }
    return preferences.hidden.length > 0;
  }, [preferences.order, preferences.hidden, availableKeys]);

  return {
    columns: visibleColumns,
    settings,
    moveColumn,
    setColumnVisibility,
    reset,
    hasCustomSettings,
  };
};
