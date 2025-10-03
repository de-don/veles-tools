import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { BotIdentifier, BotSummary } from '../types/bots';
import type { BotStrategy } from '../api/backtestRunner';

export interface ImportedBotEntry {
  id: string;
  alias: string;
  sourceUrl: string;
  summary: BotSummary;
  strategy: BotStrategy;
  savedAt: number;
}

interface ImportedBotsContextValue {
  bots: ImportedBotEntry[];
  upsertBots: (entries: ImportedBotEntry[]) => void;
  removeBot: (id: string) => void;
  clearAll: () => void;
  getStrategyById: (id: BotIdentifier) => BotStrategy | null;
  getEntryById: (id: BotIdentifier) => ImportedBotEntry | null;
}

const STORAGE_KEY = 'veles:imported-bots';

const ImportedBotsContext = createContext<ImportedBotsContextValue | null>(null);

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normaliseSummary = (summary: BotSummary, fallbackId: string): BotSummary => {
  return {
    id: summary.id ?? fallbackId,
    name: summary.name,
    exchange: summary.exchange,
    algorithm: summary.algorithm,
    status: summary.status,
    substatus: summary.substatus ?? null,
    origin: summary.origin ?? 'imported',
  };
};

const parseStoredEntries = (raw: string): ImportedBotEntry[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: ImportedBotEntry[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) {
        continue;
      }
      const { id, alias, sourceUrl, summary, strategy, savedAt } = item;
      if (typeof id !== 'string' || typeof alias !== 'string' || typeof sourceUrl !== 'string') {
        continue;
      }
      if (!isRecord(summary) || !isRecord(strategy) || typeof savedAt !== 'number') {
        continue;
      }

      const preparedSummary = normaliseSummary(summary as BotSummary, id);
      preparedSummary.origin = 'imported';

      result.push({
        id,
        alias,
        sourceUrl,
        summary: preparedSummary,
        strategy: strategy as BotStrategy,
        savedAt,
      });
    }

    return result;
  } catch (error) {
    console.warn('[Veles UI] Не удалось прочитать импортированных ботов из storage', error);
    return [];
  }
};

const persistEntries = (entries: ImportedBotEntry[]) => {
  try {
    const payload = JSON.stringify(entries);
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.warn('[Veles UI] Не удалось сохранить импортированных ботов', error);
  }
};

export const ImportedBotsProvider = ({ children }: PropsWithChildren) => {
  const [bots, setBots] = useState<ImportedBotEntry[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return [];
      }
      return parseStoredEntries(stored);
    } catch (error) {
      console.warn('[Veles UI] Ошибка чтения storage импортированных ботов', error);
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    persistEntries(bots);
  }, [bots]);

  const upsertBots = useCallback((entries: ImportedBotEntry[]) => {
    setBots((current) => {
      const map = new Map<string, ImportedBotEntry>();
      for (const existing of current) {
        map.set(existing.id, existing);
      }
      for (const entry of entries) {
        map.set(entry.id, {
          ...entry,
          summary: {
            ...entry.summary,
            origin: 'imported',
            id: entry.summary.id ?? entry.id,
          },
        });
      }
      return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
    });
  }, []);

  const removeBot = useCallback((id: string) => {
    setBots((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setBots([]);
  }, []);

  const getEntryById = useCallback(
    (id: BotIdentifier): ImportedBotEntry | null => {
      const key = String(id);
      return bots.find((entry) => entry.id === key) ?? null;
    },
    [bots],
  );

  const getStrategyById = useCallback(
    (id: BotIdentifier): BotStrategy | null => {
      const entry = getEntryById(id);
      return entry ? entry.strategy : null;
    },
    [getEntryById],
  );

  const value = useMemo<ImportedBotsContextValue>(
    () => ({ bots, upsertBots, removeBot, clearAll, getStrategyById, getEntryById }),
    [bots, upsertBots, removeBot, clearAll, getStrategyById, getEntryById],
  );

  return <ImportedBotsContext.Provider value={value}>{children}</ImportedBotsContext.Provider>;
};

export const useImportedBots = (): ImportedBotsContextValue => {
  const context = useContext(ImportedBotsContext);
  if (!context) {
    throw new Error('useImportedBots должен использоваться внутри ImportedBotsProvider');
  }
  return context;
};

