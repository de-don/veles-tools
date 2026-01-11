import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ACTIVE_DEALS_DEFAULT_SIZE, fetchAllActiveDeals } from '../api/activeDeals';
import { fetchApiKeys } from '../api/apiKeys';
import { positionConstraintsService } from '../services/positionConstraints';
import {
  DEFAULT_DYNAMIC_BLOCK_CONFIG,
  normalizeDynamicBlockConfigs,
  persistDynamicBlockConfigs,
  readDynamicBlockConfigs,
  resolveConfigForApiKey,
} from '../storage/dynamicPositionBlocksStore';
import type { ActiveDeal } from '../types/activeDeals';
import type { ApiKey } from '../types/apiKeys';
import type { DynamicBlockConfig, PositionConstraint } from '../types/positionConstraints';
import { useDealsRefresh } from './DealsRefreshContext';

type AutomationState = 'idle' | 'updated' | 'cooldown' | 'skipped' | 'error';

export interface AutomationStatus {
  state: AutomationState;
  lastCheckedAt: number | null;
  lastChangeAt: number | null;
  lastLimit: number | null;
  note?: string;
}

export interface DynamicBlocksContextValue {
  configs: Record<number, DynamicBlockConfig>;
  activeConfigs: DynamicBlockConfig[];
  constraints: PositionConstraint[];
  openPositionsByKey: Map<number, number>;
  automationStatuses: Record<number, AutomationStatus>;
  loadingSnapshot: boolean;
  snapshotError: string | null;
  automationError: string | null;
  lastSnapshotAt: number | null;
  apiKeys: ApiKey[];
  refreshSnapshot: () => Promise<{
    constraints: PositionConstraint[];
    openPositionsByKey: Map<number, number>;
    apiKeys: ApiKey[];
  } | null>;
  manualRun: () => Promise<void>;
  upsertConfig: (config: DynamicBlockConfig) => void;
  disableConfig: (apiKeyId: number) => void;
  resetConfig: (apiKeyId: number) => void;
}

const DynamicBlocksContext = createContext<DynamicBlocksContextValue | undefined>(undefined);

interface DynamicBlocksProviderProps extends PropsWithChildren {
  extensionReady: boolean;
}

const OPEN_POSITIONS_PADDING = 1;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const countOpenPositions = (deals: ActiveDeal[]): Map<number, number> => {
  const counts = new Map<number, number>();
  deals.forEach((deal) => {
    const previous = counts.get(deal.apiKeyId) ?? 0;
    counts.set(deal.apiKeyId, previous + 1);
  });
  return counts;
};

const computeNextLimit = (currentOpenPositions: number, currentBlock: number, config: DynamicBlockConfig): number => {
  const normalizedBlock = clamp(currentBlock, config.minPositionsBlock, config.maxPositionsBlock);
  if (currentOpenPositions >= config.maxPositionsBlock) {
    return config.maxPositionsBlock;
  }
  if (currentOpenPositions < normalizedBlock - OPEN_POSITIONS_PADDING) {
    const target = currentOpenPositions + OPEN_POSITIONS_PADDING;
    return Math.max(target, config.minPositionsBlock);
  }
  if (currentOpenPositions >= normalizedBlock) {
    return Math.min(normalizedBlock + 1, config.maxPositionsBlock);
  }
  return normalizedBlock;
};

export const DynamicBlocksProvider = ({ children, extensionReady }: DynamicBlocksProviderProps) => {
  const { refreshInterval: dealsRefreshInterval } = useDealsRefresh();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [constraints, setConstraints] = useState<PositionConstraint[]>([]);
  const [openPositionsByKey, setOpenPositionsByKey] = useState<Map<number, number>>(new Map());
  const [configs, setConfigs] = useState<Record<number, DynamicBlockConfig>>({});
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<number | null>(null);
  const [automationStatuses, setAutomationStatuses] = useState<Record<number, AutomationStatus>>({});

  const lastChecksRef = useRef<Record<number, number>>({});
  const automationInFlightRef = useRef(false);
  const pendingImmediateRunRef = useRef<Record<number, DynamicBlockConfig> | null>(null);

  const activeConfigs = useMemo(() => Object.values(configs), [configs]);

  const _computeCurrentBlockValue = (apiKeyId: number): number => {
    const constraint = constraints.find((item) => item.apiKeyId === apiKeyId);
    const config = resolveConfigForApiKey(apiKeyId, configs);
    const hasLimit = constraint?.limit !== null && constraint?.limit !== undefined;
    const rawLimit = hasLimit ? Number(constraint?.limit) : config.maxPositionsBlock;
    return clamp(rawLimit, config.minPositionsBlock, config.maxPositionsBlock);
  };

  const refreshSnapshot = useCallback(async (): Promise<{
    constraints: PositionConstraint[];
    openPositionsByKey: Map<number, number>;
    apiKeys: ApiKey[];
  } | null> => {
    if (!extensionReady) {
      setSnapshotError('Расширение Veles Tools неактивно.');
      return null;
    }
    setLoadingSnapshot(true);
    setSnapshotError(null);

    try {
      const [apiKeysResponse, constraintsResponse, deals] = await Promise.all([
        fetchApiKeys({ size: 100 }),
        positionConstraintsService.getPositionConstraints(),
        fetchAllActiveDeals({ size: ACTIVE_DEALS_DEFAULT_SIZE }),
      ]);

      setApiKeys(apiKeysResponse);
      setConstraints(constraintsResponse);
      const positions = countOpenPositions(deals);
      setOpenPositionsByKey(positions);
      setLastSnapshotAt(Date.now());
      return { constraints: constraintsResponse, openPositionsByKey: positions, apiKeys: apiKeysResponse };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSnapshotError(message);
      return null;
    } finally {
      setLoadingSnapshot(false);
    }
  }, [extensionReady]);

  useEffect(() => {
    if (!extensionReady) {
      return;
    }
    refreshSnapshot().catch(() => {});
  }, [extensionReady, refreshSnapshot]);

  useEffect(() => {
    let isActive = true;
    readDynamicBlockConfigs()
      .then((stored) => {
        if (isActive) {
          setConfigs(stored);
        }
      })
      .catch((error) => {
        console.warn('[Veles Tools] Не удалось загрузить dynamic-blocks из IndexedDB', error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const updateAutomationStatuses = useCallback((updates: Record<number, AutomationStatus>) => {
    setAutomationStatuses((prev) => ({ ...prev, ...updates }));
  }, []);

  const runAutomation = useCallback(
    async (triggeredManually = false, configsOverride?: Record<number, DynamicBlockConfig>) => {
      if (!extensionReady) {
        return;
      }
      if (automationInFlightRef.current) {
        if (triggeredManually) {
          pendingImmediateRunRef.current = configsOverride ?? configs;
        }
        return;
      }
      const configsSnapshot = configsOverride ?? configs;
      const enabledConfigs = Object.values(configsSnapshot);
      if (enabledConfigs.length === 0) {
        return;
      }

      const now = Date.now();
      const dueConfigs = enabledConfigs.filter((config) => {
        const lastCheck = lastChecksRef.current[config.apiKeyId] ?? 0;
        return triggeredManually || now - lastCheck >= dealsRefreshInterval * 1000;
      });
      if (dueConfigs.length === 0) {
        return;
      }

      automationInFlightRef.current = true;
      setAutomationError(null);

      try {
        const snapshot = (await refreshSnapshot()) ?? {
          constraints,
          openPositionsByKey,
          apiKeys,
        };
        const snapshotConstraints = snapshot.constraints ?? [];
        const updates: Record<number, AutomationStatus> = {};

        for (const config of dueConfigs) {
          lastChecksRef.current[config.apiKeyId] = now;
          const constraint =
            snapshotConstraints.find((item) => item.apiKeyId === config.apiKeyId) ??
            constraints.find((item) => item.apiKeyId === config.apiKeyId) ??
            null;

          if (!constraint) {
            updates[config.apiKeyId] = {
              state: 'error',
              lastCheckedAt: now,
              lastChangeAt: config.lastChangeAt,
              lastLimit: null,
              note: 'Не найден исходный constraint для API-ключа.',
            };
            continue;
          }

          const openPositions = snapshot.openPositionsByKey.get(config.apiKeyId) ?? 0;
          const rawLimit =
            constraint.limit !== null && constraint.limit !== undefined ? constraint.limit : config.maxPositionsBlock;
          const cooldownPassed =
            !config.lastChangeAt || now - config.lastChangeAt >= config.timeoutBetweenChangesSec * 1000;
          const nextLimit = computeNextLimit(openPositions, rawLimit, config);
          const isDecrease = nextLimit < rawLimit;

          if (!(cooldownPassed || isDecrease)) {
            const remainingMs = config.timeoutBetweenChangesSec * 1000 - (now - (config.lastChangeAt ?? 0));
            updates[config.apiKeyId] = {
              state: 'cooldown',
              lastCheckedAt: now,
              lastChangeAt: config.lastChangeAt,
              lastLimit: rawLimit,
              note: `Ожидаем ${Math.ceil(remainingMs / 1000)} секунд до следующей попытки`,
            };
            continue;
          }

          if (nextLimit === rawLimit) {
            updates[config.apiKeyId] = {
              state: 'skipped',
              lastCheckedAt: now,
              lastChangeAt: config.lastChangeAt,
              lastLimit: rawLimit,
              note: 'Изменение блокировки не требуется',
            };
            continue;
          }

          await positionConstraintsService.setPositionConstraintLimit({
            apiKeyId: config.apiKeyId,
            limit: nextLimit,
            positionEnabled: constraint.positionEnabled,
            long: constraint.long ?? null,
            short: constraint.short ?? null,
          });

          setConstraints((prev) =>
            prev.map((item) =>
              item.apiKeyId === config.apiKeyId ? { ...item, limit: nextLimit, positionEnabled: true } : item,
            ),
          );

          setConfigs((prev) => {
            const current = resolveConfigForApiKey(config.apiKeyId, prev);
            const nextRecord = { ...prev, [config.apiKeyId]: { ...current, lastChangeAt: now } };
            void persistDynamicBlockConfigs(nextRecord);
            return normalizeDynamicBlockConfigs(nextRecord);
          });

          updates[config.apiKeyId] = {
            state: 'updated',
            lastCheckedAt: now,
            lastChangeAt: now,
            lastLimit: nextLimit,
            note: `Лимит обновлён до ${nextLimit}`,
          };
        }

        if (Object.keys(updates).length > 0) {
          updateAutomationStatuses(updates);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setAutomationError(message);
      } finally {
        automationInFlightRef.current = false;
        if (pendingImmediateRunRef.current) {
          const pendingConfigs = pendingImmediateRunRef.current;
          pendingImmediateRunRef.current = null;
          runAutomation(true, pendingConfigs).catch(() => {});
        }
      }
    },
    [
      apiKeys,
      configs,
      constraints,
      dealsRefreshInterval,
      extensionReady,
      openPositionsByKey,
      refreshSnapshot,
      updateAutomationStatuses,
    ],
  );

  useEffect(() => {
    if (!extensionReady || activeConfigs.length === 0) {
      return;
    }
    const timerId = window.setInterval(() => {
      runAutomation().catch(() => {});
    }, dealsRefreshInterval * 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [extensionReady, activeConfigs.length, dealsRefreshInterval, runAutomation]);

  const manualRun = useCallback(async () => {
    await runAutomation(true);
  }, [runAutomation]);

  const upsertConfig = useCallback(
    (config: DynamicBlockConfig) => {
      let nextRecord: Record<number, DynamicBlockConfig> | null = null;
      setConfigs((prev) => {
        const merged = { ...prev, [config.apiKeyId]: { ...config, checkPeriodSec: dealsRefreshInterval } };
        nextRecord = normalizeDynamicBlockConfigs(merged);
        void persistDynamicBlockConfigs(nextRecord);
        return nextRecord;
      });
      if (nextRecord && extensionReady) {
        pendingImmediateRunRef.current = nextRecord;
        runAutomation(true, nextRecord).catch(() => {});
      }
    },
    [dealsRefreshInterval, extensionReady, runAutomation],
  );

  const disableConfig = useCallback((apiKeyId: number) => {
    setConfigs((prev) => {
      const next = { ...prev };
      delete next[apiKeyId];
      void persistDynamicBlockConfigs(next);
      return normalizeDynamicBlockConfigs(next);
    });
    setAutomationStatuses((prev) => {
      const next = { ...prev };
      delete next[apiKeyId];
      return next;
    });
  }, []);

  const resetConfig = useCallback(
    (apiKeyId: number) => {
      setConfigs((prev) => {
        const next = {
          ...prev,
          [apiKeyId]: {
            ...resolveConfigForApiKey(apiKeyId, prev),
            minPositionsBlock: DEFAULT_DYNAMIC_BLOCK_CONFIG.minPositionsBlock,
            maxPositionsBlock: DEFAULT_DYNAMIC_BLOCK_CONFIG.maxPositionsBlock,
            timeoutBetweenChangesSec: DEFAULT_DYNAMIC_BLOCK_CONFIG.timeoutBetweenChangesSec,
            checkPeriodSec: dealsRefreshInterval,
            lastChangeAt: null,
            enabled: resolveConfigForApiKey(apiKeyId, prev).enabled,
            apiKeyId,
          },
        };
        void persistDynamicBlockConfigs(next);
        return normalizeDynamicBlockConfigs(next);
      });
    },
    [dealsRefreshInterval],
  );

  const value = useMemo<DynamicBlocksContextValue>(
    () => ({
      configs,
      activeConfigs,
      constraints,
      openPositionsByKey,
      automationStatuses,
      loadingSnapshot,
      snapshotError,
      automationError,
      lastSnapshotAt,
      apiKeys,
      refreshSnapshot,
      manualRun,
      upsertConfig,
      disableConfig,
      resetConfig,
    }),
    [
      configs,
      activeConfigs,
      constraints,
      openPositionsByKey,
      automationStatuses,
      loadingSnapshot,
      snapshotError,
      automationError,
      lastSnapshotAt,
      apiKeys,
      refreshSnapshot,
      manualRun,
      upsertConfig,
      disableConfig,
      resetConfig,
    ],
  );

  return <DynamicBlocksContext.Provider value={value}>{children}</DynamicBlocksContext.Provider>;
};

export const useDynamicBlocks = (): DynamicBlocksContextValue => {
  const context = useContext(DynamicBlocksContext);
  if (!context) {
    throw new Error('useDynamicBlocks must be used within a DynamicBlocksProvider');
  }
  return context;
};
