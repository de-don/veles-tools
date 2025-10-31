import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import { readBacktestGroups, writeBacktestGroups } from '../storage/backtestGroupsStore';
import type { BacktestGroup } from '../types/backtestGroups';

interface BacktestGroupsContextValue {
  groups: BacktestGroup[];
  createGroup: (name: string, backtestIds: number[]) => BacktestGroup | null;
  appendToGroup: (groupId: string, backtestIds: number[]) => BacktestGroup | null;
  updateGroupName: (groupId: string, name: string) => BacktestGroup | null;
  deleteGroup: (groupId: string) => void;
  removeBacktests: (groupId: string, backtestIds: number[]) => BacktestGroup | null;
  refresh: () => void;
}

const BacktestGroupsContext = createContext<BacktestGroupsContextValue | undefined>(undefined);

const generateGroupId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeBacktestIds = (ids: number[]): number[] => {
  const unique = Array.from(new Set(ids.filter((id) => typeof id === 'number' && Number.isFinite(id))));
  unique.sort((a, b) => a - b);
  return unique;
};

export const BacktestGroupsProvider = ({ children }: PropsWithChildren) => {
  const [groups, setGroups] = useState<BacktestGroup[]>(() => readBacktestGroups());

  const persist = useCallback((nextGroups: BacktestGroup[]) => {
    setGroups(nextGroups);
    writeBacktestGroups(nextGroups);
  }, []);

  const createGroup = useCallback(
    (name: string, backtestIds: number[]): BacktestGroup | null => {
      const trimmedName = name.trim();
      const normalizedIds = normalizeBacktestIds(backtestIds);
      if (trimmedName.length === 0 || normalizedIds.length === 0) {
        return null;
      }
      const timestamp = Date.now();
      const group: BacktestGroup = {
        id: generateGroupId(),
        name: trimmedName,
        backtestIds: normalizedIds,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      persist([...groups, group]);
      return group;
    },
    [groups, persist],
  );

  const appendToGroup = useCallback(
    (groupId: string, backtestIds: number[]): BacktestGroup | null => {
      if (!groupId) {
        return null;
      }
      const normalizedIds = normalizeBacktestIds(backtestIds);
      if (normalizedIds.length === 0) {
        return null;
      }

      let updatedGroup: BacktestGroup | null = null;
      let changed = false;
      const nextGroups = groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const mergedIds = normalizeBacktestIds([...group.backtestIds, ...normalizedIds]);
        if (mergedIds.length === group.backtestIds.length) {
          updatedGroup = group;
          return group;
        }
        changed = true;
        updatedGroup = {
          ...group,
          backtestIds: mergedIds,
          updatedAt: Date.now(),
        };
        return updatedGroup;
      });

      if (!updatedGroup) {
        return null;
      }

      if (changed) {
        persist(nextGroups);
      }
      return updatedGroup;
    },
    [groups, persist],
  );

  const updateGroupName = useCallback(
    (groupId: string, name: string): BacktestGroup | null => {
      const trimmedName = name.trim();
      if (!groupId || trimmedName.length === 0) {
        return null;
      }

      let updatedGroup: BacktestGroup | null = null;
      const nextGroups = groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        updatedGroup = {
          ...group,
          name: trimmedName,
          updatedAt: Date.now(),
        };
        return updatedGroup;
      });

      if (!updatedGroup) {
        return null;
      }

      persist(nextGroups);
      return updatedGroup;
    },
    [groups, persist],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      if (!groupId) {
        return;
      }
      const nextGroups = groups.filter((group) => group.id !== groupId);
      if (nextGroups.length === groups.length) {
        return;
      }
      persist(nextGroups);
    },
    [groups, persist],
  );

  const removeBacktests = useCallback(
    (groupId: string, backtestIds: number[]): BacktestGroup | null => {
      if (!groupId || backtestIds.length === 0) {
        return null;
      }
      const idsToRemove = new Set(backtestIds);
      let updatedGroup: BacktestGroup | null = null;
      const nextGroups = groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const filteredIds = group.backtestIds.filter((id) => !idsToRemove.has(id));
        if (filteredIds.length === group.backtestIds.length) {
          updatedGroup = group;
          return group;
        }
        updatedGroup = {
          ...group,
          backtestIds: filteredIds,
          updatedAt: Date.now(),
        };
        return updatedGroup;
      });

      if (!updatedGroup) {
        return null;
      }

      persist(nextGroups);
      return updatedGroup;
    },
    [groups, persist],
  );

  const refresh = useCallback(() => {
    setGroups(readBacktestGroups());
  }, []);

  const value = useMemo<BacktestGroupsContextValue>(
    () => ({
      groups,
      createGroup,
      appendToGroup,
      updateGroupName,
      deleteGroup,
      removeBacktests,
      refresh,
    }),
    [groups, createGroup, appendToGroup, updateGroupName, deleteGroup, removeBacktests, refresh],
  );

  return <BacktestGroupsContext.Provider value={value}>{children}</BacktestGroupsContext.Provider>;
};

export const useBacktestGroups = (): BacktestGroupsContextValue => {
  const context = useContext(BacktestGroupsContext);
  if (!context) {
    throw new Error('useBacktestGroups must be used within BacktestGroupsProvider');
  }
  return context;
};
