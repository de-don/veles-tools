import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type {
  BotIdentifier,
  BotOrder,
  BotSettings,
  BotSummary,
  BotStatus,
  StrategyCondition,
} from '../types/bots';
import type { BotStrategy, BotStrategyCommissions, BotStrategyPair } from '../api/backtestRunner';

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

const isBotIdentifier = (value: unknown): value is BotIdentifier => {
  return typeof value === 'string' || typeof value === 'number';
};

const toNullableString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const toNullableBoolean = (value: unknown): boolean | null => {
  return typeof value === 'boolean' ? value : null;
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const parseStrategyCondition = (raw: unknown): StrategyCondition | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const type = toNullableString(raw.type);
  if (!type) {
    return null;
  }
  return {
    type,
    indicator: toNullableString(raw.indicator),
    interval: toNullableString(raw.interval),
    basic: toNullableBoolean(raw.basic),
    value: toNullableNumber(raw.value),
    operation: toNullableString(raw.operation),
    closed: toNullableBoolean(raw.closed),
    reverse: toNullableBoolean(raw.reverse),
  };
};

const parseConditions = (raw: unknown): StrategyCondition[] | null => {
  if (!Array.isArray(raw)) {
    return null;
  }
  const parsed = raw
    .map((item) => parseStrategyCondition(item))
    .filter((item): item is StrategyCondition => Boolean(item));
  return parsed.length > 0 ? parsed : null;
};

const parseOrder = (raw: unknown): BotOrder | null => {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    indent: toNullableNumber(raw.indent),
    volume: toNullableNumber(raw.volume),
    conditions: parseConditions(raw.conditions),
  };
};

const parseSettings = (raw: unknown): BotSettings | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const type = toNullableString(raw.type);
  if (!type) {
    return null;
  }
  const baseOrder = parseOrder(raw.baseOrder);
  const orders = Array.isArray(raw.orders)
    ? raw.orders
        .map((order) => parseOrder(order))
        .filter((order): order is BotOrder => Boolean(order))
    : null;

  return {
    type,
    baseOrder: baseOrder ?? null,
    orders: orders && orders.length > 0 ? orders : null,
    indentType: toNullableString(raw.indentType),
    includePosition: toNullableBoolean(raw.includePosition),
  };
};

const parseStrategyPair = (raw: unknown): BotStrategyPair | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const pair: BotStrategyPair = {
    exchange: toNullableString(raw.exchange),
    type: toNullableString(raw.type),
    from: toNullableString(raw.from),
    to: toNullableString(raw.to),
    symbol: toNullableString(raw.symbol),
  };
  return pair.exchange || pair.type || pair.from || pair.to || pair.symbol ? pair : null;
};

const parseStrategyCommissions = (raw: unknown): BotStrategyCommissions | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const maker = raw.maker;
  const taker = raw.taker;
  const normalized: BotStrategyCommissions = {};
  if (typeof maker === 'number' || typeof maker === 'string') {
    normalized.maker = maker;
  }
  if (typeof taker === 'number' || typeof taker === 'string') {
    normalized.taker = taker;
  }
  return normalized.maker !== undefined || normalized.taker !== undefined ? normalized : null;
};

const parseBotSummary = (summary: unknown, fallbackId: string): BotSummary | null => {
  if (!isRecord(summary)) {
    return null;
  }
  const id = isBotIdentifier(summary.id) ? summary.id : fallbackId;
  const name = toNullableString(summary.name);
  const exchange = toNullableString(summary.exchange);
  const algorithm = toNullableString(summary.algorithm);
  const status = toNullableString(summary.status) as BotStatus | null;
  if (!name || !exchange || !algorithm || !status) {
    return null;
  }
  const substatus = toNullableString(summary.substatus);
  const origin = summary.origin === 'account' ? 'account' : 'imported';
  return {
    id,
    name,
    exchange,
    algorithm,
    status,
    substatus,
    origin,
  };
};

const parseBotStrategy = (strategy: unknown): BotStrategy | null => {
  if (!isRecord(strategy)) {
    return null;
  }
  const symbols = Array.isArray(strategy.symbols)
    ? strategy.symbols.filter((item): item is string => typeof item === 'string')
    : null;

  const publicValue = 'public' in strategy ? strategy.public : undefined;

  const result: BotStrategy = {
    id: isBotIdentifier(strategy.id) ? strategy.id : null,
    name: toNullableString(strategy.name),
    symbol: toNullableString(strategy.symbol),
    symbols,
    pair: parseStrategyPair(strategy.pair),
    exchange: toNullableString(strategy.exchange),
    status: toNullableString(strategy.status),
    substatus: toNullableString(strategy.substatus),
    lastFail: 'lastFail' in strategy ? strategy.lastFail : undefined,
    commissions: parseStrategyCommissions(strategy.commissions),
    useWicks: toNullableBoolean(strategy.useWicks),
    from: toNullableString(strategy.from),
    to: toNullableString(strategy.to),
    cursor: toNullableString(strategy.cursor),
    includePosition: toNullableBoolean(strategy.includePosition),
    public: toNullableBoolean(publicValue),
    algorithm: toNullableString(strategy.algorithm),
    settings: parseSettings(strategy.settings),
  };

  return result;
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

      const preparedSummary = parseBotSummary(summary, id);
      const preparedStrategy = parseBotStrategy(strategy);
      if (!preparedSummary || !preparedStrategy) {
        continue;
      }
      preparedSummary.origin = 'imported';

      result.push({
        id,
        alias,
        sourceUrl,
        summary: preparedSummary,
        strategy: preparedStrategy,
        savedAt,
      });
    }

    return result;
  } catch (error) {
    console.warn('[Veles Tools] Не удалось прочитать импортированных ботов из storage', error);
    return [];
  }
};

const persistEntries = (entries: ImportedBotEntry[]) => {
  try {
    const payload = JSON.stringify(entries);
    window.localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    console.warn('[Veles Tools] Не удалось сохранить импортированных ботов', error);
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
      console.warn('[Veles Tools] Ошибка чтения storage импортированных ботов', error);
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
