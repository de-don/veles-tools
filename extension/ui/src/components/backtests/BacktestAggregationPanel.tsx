import { DownOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Modal, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AggregationSummary,
  type BacktestAggregationMetrics,
  computeBacktestMetrics,
  summarizeAggregations,
} from '../../lib/backtestAggregation';
import { formatAmount, formatDateRu, formatLeverage, formatPercent } from '../../lib/backtestFormatting';
import { resolveSortableNumber } from '../../lib/backtestSorting';
import type { LimitImpactPoint } from '../../lib/chartOptions';
import { useTableColumnSettings } from '../../lib/useTableColumnSettings';
import { backtestsService, DEFAULT_CYCLES_PAGE_SIZE } from '../../services/backtests';
import type { BacktestDetail, BacktestStatistics } from '../../types/backtests';
import CreateBotsFromBacktestsModal, { type BacktestBotTarget } from '../CreateBotsFromBacktestsModal';
import { AggregateRiskChart } from '../charts/AggregateRiskChart';
import { DailyConcurrencyChart } from '../charts/DailyConcurrencyChart';
import { LimitImpactChart, LimitRiskEfficiencyChart } from '../charts/LimitImpactChart';
import { PortfolioEquityChart } from '../charts/PortfolioEquityChart';
import { InfoTooltip } from '../ui/InfoTooltip';
import { StatisticCard, type StatisticCardProps } from '../ui/StatisticCard';
import { TableColumnSettingsButton } from '../ui/TableColumnSettingsButton';
import { type TabItem, Tabs } from '../ui/Tabs';

interface BacktestAggregationPanelProps {
  extensionReady: boolean;
  selectedBacktests: BacktestStatistics[];
  onRemoveSelected?: (ids: number[]) => void;
  onRemoveUnselected?: (ids: number[]) => void;
}

type AggregationStatus = 'idle' | 'loading' | 'success' | 'error';

interface AggregationItemState {
  id: number;
  status: AggregationStatus;
  included: boolean;
  metrics?: BacktestAggregationMetrics;
  detail?: BacktestDetail;
  error?: string;
}

interface AggregationState {
  items: Map<number, AggregationItemState>;
  running: boolean;
  total: number;
  completed: number;
  lastRunAt: number | null;
}

const aggregationNumberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const aggregationIntegerFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

const formatSignedAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (Math.abs(value) < 1e-9) {
    return '0.00';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${aggregationNumberFormatter.format(value)}`;
};

const formatAggregationValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return aggregationNumberFormatter.format(value);
};

const formatAggregationInteger = (value: number | null | undefined, noSpace = false): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  const result = aggregationIntegerFormatter.format(value);

  return noSpace ? result.replace(/\s/g, '') : result;
};

const resolveTrend = (value: number | null | undefined): StatisticCardProps['trend'] => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'muted';
  }
  if (Math.abs(value) < 1e-9) {
    return 'neutral';
  }
  return value > 0 ? 'positive' : 'negative';
};

const logBacktestsError = (context: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[Backtests] ${context}: ${message}`, error);
  }
  return message;
};

const buildAggregationInitialState = (): AggregationState => ({
  items: new Map(),
  running: false,
  total: 0,
  completed: 0,
  lastRunAt: null,
});

const BacktestAggregationPanel = ({
  extensionReady,
  selectedBacktests,
  onRemoveSelected,
  onRemoveUnselected,
}: BacktestAggregationPanelProps) => {
  const [aggregationState, setAggregationState] = useState<AggregationState>(buildAggregationInitialState);
  const [activeAggregationTab, setActiveAggregationTab] = useState<string>('metrics');
  const [botLimit, setBotLimit] = useState<number | null>(null);
  const [botCreationOpen, setBotCreationOpen] = useState(false);
  const [botCreationTargets, setBotCreationTargets] = useState<BacktestBotTarget[]>([]);

  const totalSelected = selectedBacktests.length;
  const selectedIds = useMemo(() => selectedBacktests.map((item) => item.id), [selectedBacktests]);

  useEffect(() => {
    if (!extensionReady) {
      setAggregationState(buildAggregationInitialState());
      setBotLimit(null);
      setBotCreationOpen(false);
      setBotCreationTargets([]);
    }
  }, [extensionReady]);

  useEffect(() => {
    if (totalSelected === 0) {
      setBotLimit(null);
      return;
    }

    setBotLimit((previous) => {
      if (previous === null) {
        return totalSelected;
      }
      if (previous > totalSelected) {
        return totalSelected;
      }
      if (previous < 1) {
        return 1;
      }
      return previous;
    });
  }, [totalSelected]);

  useEffect(() => {
    setAggregationState((prev) => {
      const nextItems = new Map<number, AggregationItemState>();
      selectedBacktests.forEach(({ id }) => {
        const existing = prev.items.get(id);
        if (existing) {
          nextItems.set(id, existing);
        } else {
          nextItems.set(id, { id, status: 'idle', included: true });
        }
      });

      if (nextItems.size === prev.items.size) {
        let unchanged = true;
        nextItems.forEach((_, key) => {
          if (!prev.items.has(key)) {
            unchanged = false;
          }
        });
        if (unchanged) {
          return prev;
        }
      }

      return {
        ...prev,
        items: nextItems,
        total: prev.running ? prev.total : 0,
        completed: prev.running ? Math.min(prev.completed, nextItems.size) : 0,
      };
    });
  }, [selectedBacktests]);

  const aggregationItems = useMemo(() => Array.from(aggregationState.items.values()), [aggregationState.items]);

  const includedActionableTargets = useMemo<BacktestBotTarget[]>(
    () =>
      aggregationItems
        .filter((item) => item.status === 'success' && item.included && item.detail)
        .map((item) => ({
          id: item.id,
          detail: item.detail as BacktestDetail,
        })),
    [aggregationItems],
  );

  const handleOpenBotCreation = useCallback(() => {
    if (includedActionableTargets.length === 0) {
      return;
    }
    setBotCreationTargets(includedActionableTargets);
    setBotCreationOpen(true);
  }, [includedActionableTargets]);

  const handleBotCreationClose = useCallback(() => {
    setBotCreationOpen(false);
    setBotCreationTargets([]);
  }, []);

  const [cachePreloading, setCachePreloading] = useState(false);

  const pendingCachedEntries = useMemo(() => {
    const entries: Array<[number, BacktestStatistics]> = [];
    selectedBacktests.forEach((summary) => {
      const stateItem = aggregationState.items.get(summary.id);
      if (!stateItem || stateItem.status !== 'idle' || stateItem.metrics) {
        return;
      }
      entries.push([summary.id, summary]);
    });
    return entries;
  }, [selectedBacktests, aggregationState.items]);

  useEffect(() => {
    if (pendingCachedEntries.length === 0) {
      setCachePreloading(false);
      return;
    }

    let cancelled = false;
    setCachePreloading(true);

    const preloadFromCache = async () => {
      for (const [id, summary] of pendingCachedEntries) {
        if (cancelled) {
          return;
        }

        const detail = await backtestsService.readCachedBacktestDetail(id);
        if (!detail) {
          continue;
        }

        const from = summary.from ?? detail.statistics.from;
        const to = summary.to ?? detail.statistics.to;

        let cycles = await backtestsService.readCachedBacktestCycles(id, {
          from,
          to,
          pageSize: DEFAULT_CYCLES_PAGE_SIZE,
        });
        if (!cycles) {
          cycles = await backtestsService.readCachedBacktestCycles(id, {
            pageSize: DEFAULT_CYCLES_PAGE_SIZE,
          });
        }
        if (!cycles || cancelled) {
          if (cancelled) {
            return;
          }
          continue;
        }

        const metrics = computeBacktestMetrics(detail, cycles);

        setAggregationState((prev) => {
          const existing = prev.items.get(id);
          if (!existing || existing.status !== 'idle' || existing.metrics) {
            return prev;
          }
          const nextItems = new Map(prev.items);
          nextItems.set(id, {
            ...existing,
            status: 'success',
            included: existing.included ?? true,
            metrics,
            detail,
            error: undefined,
          });
          return { ...prev, items: nextItems };
        });
      }
    };

    void preloadFromCache()
      .catch((error) => {
        console.warn('[Backtests] Ошибка предварительной загрузки из кеша', error);
      })
      .finally(() => {
        if (!cancelled) {
          setCachePreloading(false);
        }
      });

    return () => {
      cancelled = true;
      setCachePreloading(false);
    };
  }, [pendingCachedEntries]);

  const collectedItems = useMemo(
    () => aggregationItems.filter((item) => item.status === 'success' && item.metrics),
    [aggregationItems],
  );

  const includedMetrics = useMemo(
    () => collectedItems.filter((item) => item.included).map((item) => item.metrics as BacktestAggregationMetrics),
    [collectedItems],
  );

  const hasIncompleteItems = useMemo(() => {
    if (aggregationItems.length === 0) {
      return totalSelected > 0;
    }
    return aggregationItems.some((item) => item.status !== 'success' || !item.metrics);
  }, [aggregationItems, totalSelected]);

  const allMetricsReady = useMemo(() => {
    if (totalSelected === 0) {
      return false;
    }
    if (aggregationItems.length !== totalSelected) {
      return false;
    }
    return !hasIncompleteItems;
  }, [aggregationItems.length, hasIncompleteItems, totalSelected]);

  const showGatherButton = totalSelected > 0 && hasIncompleteItems;
  const showAggregationTable = allMetricsReady && aggregationItems.length > 0;

  const canAdjustLimit = allMetricsReady && includedMetrics.length > 0;
  const limitDisabled = !canAdjustLimit || aggregationState.running;

  const ensureNumber = (raw: number | string | undefined): number => {
    if (typeof raw === 'number') {
      return raw;
    }
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    return Number.NaN;
  };

  const aggregationSummary = useMemo<AggregationSummary | null>(() => {
    if (!allMetricsReady || includedMetrics.length === 0) {
      return null;
    }
    const limit = botLimit;
    return summarizeAggregations(includedMetrics, typeof limit === 'number' ? { maxConcurrentBots: limit } : undefined);
  }, [allMetricsReady, includedMetrics, botLimit]);

  const aggregationErrors = useMemo(
    () => aggregationItems.filter((item) => item.status === 'error' && item.error),
    [aggregationItems],
  );

  const aggregationProgress = useMemo(() => {
    const total = aggregationState.total;
    const completed = Math.min(aggregationState.completed, total);
    const percent = total > 0 ? Math.min((completed / total) * 100, 100) : 0;
    return { total, completed, percent };
  }, [aggregationState.completed, aggregationState.total]);

  const dailyConcurrencyRecords = aggregationSummary?.dailyConcurrency.records ?? [];
  const dailyConcurrencyStats = aggregationSummary?.dailyConcurrency.stats;

  const aggregateRiskSeries = aggregationSummary?.aggregateRiskSeries ?? null;
  const aggregateRiskPeak = aggregationSummary ? aggregationSummary.aggregateMPU : null;

  const portfolioEquitySeries = aggregationSummary?.portfolioEquity ?? null;
  const portfolioFinalValue = useMemo(() => {
    if (!portfolioEquitySeries || portfolioEquitySeries.points.length === 0) {
      return null;
    }
    const lastPoint = portfolioEquitySeries.points[portfolioEquitySeries.points.length - 1];
    return lastPoint.value;
  }, [portfolioEquitySeries]);

  const limitImpactPoints = useMemo(() => {
    if (!allMetricsReady || includedMetrics.length === 0) {
      return [];
    }

    const metricsList = includedMetrics;
    const total = metricsList.length;
    if (total === 0) {
      return [];
    }

    const items: LimitImpactPoint[] = [];

    for (let limit = 1; limit <= total; limit += 1) {
      const summary = summarizeAggregations(metricsList, {
        maxConcurrentBots: limit,
      });
      items.push({
        label: `${limit}`,
        totalPnl: summary.totalPnl,
        aggregateDrawdown: summary.aggregateDrawdown,
        aggregateMPU: summary.aggregateMPU,
        aggregateWorstRisk: summary.aggregateWorstRisk,
        aggregateRiskEfficiency: summary.aggregateRiskEfficiency,
      });
    }

    const unlimitedSummary = summarizeAggregations(metricsList);
    items.push({
      label: '∞',
      totalPnl: unlimitedSummary.totalPnl,
      aggregateDrawdown: unlimitedSummary.aggregateDrawdown,
      aggregateMPU: unlimitedSummary.aggregateMPU,
      aggregateWorstRisk: unlimitedSummary.aggregateWorstRisk,
      aggregateRiskEfficiency: unlimitedSummary.aggregateRiskEfficiency,
    });

    return items;
  }, [includedMetrics, allMetricsReady]);

  const runAggregation = async () => {
    if (aggregationState.running) {
      return;
    }

    const targets = selectedIds;
    if (targets.length === 0) {
      return;
    }

    setAggregationState((prev) => ({
      ...prev,
      running: true,
      total: targets.length,
      completed: 0,
      lastRunAt: prev.lastRunAt,
    }));

    try {
      for (const id of targets) {
        setAggregationState((prev) => {
          const nextItems = new Map(prev.items);
          const existing = nextItems.get(id);
          if (!existing) {
            nextItems.set(id, { id, status: 'loading', included: true });
          } else {
            nextItems.set(id, {
              ...existing,
              status: 'loading',
              error: undefined,
            });
          }
          return {
            ...prev,
            items: nextItems,
          };
        });

        try {
          const detail = await backtestsService.getBacktestDetail(id, { forceRefresh: true });
          const cycles = await backtestsService.getBacktestCycles(id, { forceRefresh: true });
          const metrics = computeBacktestMetrics(detail, cycles);

          setAggregationState((prev) => {
            const nextCompleted = Math.min(prev.completed + 1, prev.total || targets.length);
            const current = prev.items.get(id);
            if (!current) {
              return { ...prev, completed: nextCompleted };
            }
            const nextItems = new Map(prev.items);
            nextItems.set(id, {
              ...current,
              status: 'success',
              metrics,
              detail,
              error: undefined,
            });
            return { ...prev, items: nextItems, completed: nextCompleted };
          });
        } catch (requestError) {
          const message = logBacktestsError(`Не удалось собрать статистику бэктеста ${id}`, requestError);
          setAggregationState((prev) => {
            const nextCompleted = Math.min(prev.completed + 1, prev.total || targets.length);
            const current = prev.items.get(id);
            if (!current) {
              return { ...prev, completed: nextCompleted };
            }
            const nextItems = new Map(prev.items);
            nextItems.set(id, {
              ...current,
              status: 'error',
              error: message,
            });
            return { ...prev, items: nextItems, completed: nextCompleted };
          });
        }
      }
    } finally {
      setAggregationState((prev) => ({
        ...prev,
        running: false,
        lastRunAt: Date.now(),
        total: targets.length,
        completed: Math.min(prev.completed, targets.length),
      }));
    }
  };

  const aggregationSelectedRowKeys = useMemo(
    () =>
      aggregationItems
        .filter((item) => item.status === 'success' && item.metrics && item.included)
        .map((item) => item.id),
    [aggregationItems],
  );

  const removableAggregationIds = useMemo(() => {
    return aggregationItems.filter((item) => item.status === 'success' && item.metrics).map((item) => item.id);
  }, [aggregationItems]);

  const removableUnselectedIds = useMemo(() => {
    return removableAggregationIds.filter((id) => !aggregationSelectedRowKeys.includes(id));
  }, [removableAggregationIds, aggregationSelectedRowKeys]);

  const handleRemoveSelectedAction = useCallback(() => {
    if (!onRemoveSelected) {
      return;
    }
    const selectedIds = [...aggregationSelectedRowKeys];
    if (selectedIds.length === 0) {
      return;
    }
    Modal.confirm({
      title: 'Удалить выбранные бэктесты из группы?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: () => {
        onRemoveSelected(selectedIds);
      },
    });
  }, [aggregationSelectedRowKeys, onRemoveSelected]);

  const handleRemoveUnselectedAction = useCallback(() => {
    if (!onRemoveUnselected) {
      return;
    }
    const targetIds = [...removableUnselectedIds];
    if (targetIds.length === 0) {
      return;
    }
    Modal.confirm({
      title: 'Удалить невыбранные бэктесты из группы?',
      okText: 'Удалить',
      cancelText: 'Отмена',
      onOk: () => {
        onRemoveUnselected(targetIds);
      },
    });
  }, [onRemoveUnselected, removableUnselectedIds]);

  const actionsMenuItems = useMemo(() => {
    const items: NonNullable<MenuProps['items']> = [];

    if (onRemoveSelected) {
      items.push({
        key: 'remove-selected',
        label: 'Удалить выбранные',
        disabled: aggregationSelectedRowKeys.length === 0,
      });
    }

    if (onRemoveUnselected) {
      items.push({
        key: 'remove-unselected',
        label: 'Удалить невыбранные',
        disabled: removableUnselectedIds.length === 0,
      });
    }

    if (includedActionableTargets.length > 0) {
      if (items.length > 0) {
        items.push({ type: 'divider' });
      }
      items.push({
        key: 'create-bots',
        label: 'Создать ботов из выбранных бектестов',
        disabled: includedActionableTargets.length === 0,
      });
    }

    return items;
  }, [
    aggregationSelectedRowKeys.length,
    includedActionableTargets.length,
    onRemoveSelected,
    onRemoveUnselected,
    removableUnselectedIds.length,
  ]);

  const hasActionsMenu = actionsMenuItems.length > 0;

  const handleActionsMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      if (key === 'remove-selected') {
        handleRemoveSelectedAction();
      } else if (key === 'remove-unselected') {
        handleRemoveUnselectedAction();
      } else if (key === 'create-bots') {
        handleOpenBotCreation();
      }
    },
    [handleOpenBotCreation, handleRemoveSelectedAction, handleRemoveUnselectedAction],
  );

  const handleAggregationSelectionChange = (_newSelectedRowKeys: Key[], nextSelectedRows: AggregationItemState[]) => {
    const selectedAggregationIds = new Set<number>(nextSelectedRows.map((r) => r.id));

    setAggregationState((prev) => {
      let changed = false;
      const nextItems = new Map<number, AggregationItemState>();

      prev.items.forEach((item, key) => {
        if (item.status === 'success' && item.metrics) {
          const shouldInclude = selectedAggregationIds.has(key);
          if (item.included !== shouldInclude) {
            changed = true;
            nextItems.set(key, { ...item, included: shouldInclude });
          } else {
            nextItems.set(key, item);
          }
        } else {
          nextItems.set(key, item);
        }
      });

      if (!changed) {
        return prev;
      }

      return { ...prev, items: nextItems };
    });
  };

  const aggregationRowSelection: TableRowSelection<AggregationItemState> = {
    selectedRowKeys: aggregationSelectedRowKeys,
    onChange: handleAggregationSelectionChange,
    getCheckboxProps: (record) => ({
      disabled: record.status !== 'success' || !record.metrics,
    }),
  };

  const buildMetricNumberSorter = useCallback(
    (selector: (metrics: BacktestAggregationMetrics) => number | null | undefined) => {
      return (a: AggregationItemState, b: AggregationItemState) => {
        const aValue = resolveSortableNumber(a.metrics ? selector(a.metrics) : null);
        const bValue = resolveSortableNumber(b.metrics ? selector(b.metrics) : null);
        return aValue - bValue;
      };
    },
    [],
  );

  const buildMetricStringSorter = useCallback(
    (selector: (metrics: BacktestAggregationMetrics) => string | null | undefined) => {
      return (a: AggregationItemState, b: AggregationItemState) => {
        const aValue = a.metrics ? (selector(a.metrics) ?? '') : '';
        const bValue = b.metrics ? (selector(b.metrics) ?? '') : '';
        return aValue.localeCompare(bValue, 'ru');
      };
    },
    [],
  );

  const baseAggregationColumns: ColumnsType<AggregationItemState> = useMemo(
    () => [
      {
        title: 'Бэктест',
        key: 'name',
        onCell: () => ({
          style: { minWidth: 150 },
        }),
        onHeaderCell: () => ({
          style: { minWidth: 150 },
        }),
        sorter: (a, b) => {
          const aName = a.metrics?.name ?? '';
          const bName = b.metrics?.name ?? '';
          return aName.localeCompare(bName, 'ru');
        },
        render: (_metrics, record) => (
          <div>
            <div>{record.metrics?.name ?? '—'}</div>
            <div className="panel__description">
              ID:{' '}
              <a
                href={`https://veles.finance/cabinet/backtests/${record.id}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {record.id}
              </a>
            </div>
          </div>
        ),
      },
      {
        title: 'Период',
        key: 'period',
        sorter: (a, b) => {
          const aStats = a.detail?.statistics;
          const aConfig = a.detail?.config;
          const bStats = b.detail?.statistics;
          const bConfig = b.detail?.config;
          const aFrom = aStats?.from ?? aConfig?.from ?? aStats?.date ?? null;
          const bFrom = bStats?.from ?? bConfig?.from ?? bStats?.date ?? null;
          const aTime = aFrom ? Date.parse(aFrom) : Number.NEGATIVE_INFINITY;
          const bTime = bFrom ? Date.parse(bFrom) : Number.NEGATIVE_INFINITY;
          return aTime - bTime;
        },
        render: (_metrics, record) => (
          <div>
            <div>{formatDateRu(record.detail?.statistics.from ?? record.detail?.config.from ?? null)}</div>
            <div className="panel__description">
              до {formatDateRu(record.detail?.statistics.to ?? record.detail?.config.to ?? null)}
            </div>
          </div>
        ),
      },
      {
        title: 'Биржа',
        key: 'exchange',
        sorter: (a, b) => {
          const aValue = a.detail?.statistics.exchange ?? a.detail?.config.exchange ?? '';
          const bValue = b.detail?.statistics.exchange ?? b.detail?.config.exchange ?? '';
          return aValue.localeCompare(bValue, 'ru', { sensitivity: 'base' });
        },
        render: (_metrics, record) => record.detail?.statistics.exchange ?? record.detail?.config.exchange ?? '—',
      },
      {
        title: 'Пара',
        dataIndex: 'metrics',
        key: 'symbol',
        sorter: buildMetricStringSorter((metrics) => metrics.symbol),
        render: (_metrics, record) => {
          const fallbackSymbol = record.detail?.statistics.symbol;
          const algorithm = record.detail?.config.algorithm ?? record.metrics?.name ?? '';
          return (
            <div>
              <div>{record.metrics?.symbol ?? fallbackSymbol ?? '—'}</div>
              <div className="panel__description">{algorithm}</div>
            </div>
          );
        },
      },
      {
        title: 'Депозит',
        dataIndex: 'metrics',
        key: 'deposit',
        sorter: buildMetricNumberSorter((metrics) => metrics.depositAmount ?? null),
        render: (_metrics, record) => {
          if (!record.metrics) {
            return '—';
          }
          return formatAmount(record.metrics.depositAmount, record.metrics.depositCurrency ?? undefined);
        },
      },
      {
        title: 'Плечо',
        dataIndex: 'metrics',
        key: 'leverage',
        sorter: buildMetricNumberSorter((metrics) => metrics.depositLeverage ?? null),
        render: (_metrics, record) => {
          if (!record.metrics) {
            return '—';
          }
          return formatLeverage(record.metrics.depositLeverage);
        },
      },
      {
        title: 'Win rate',
        dataIndex: 'metrics',
        key: 'winRate',
        sorter: buildMetricNumberSorter((metrics) => metrics.winRatePercent ?? null),
        render: (_metrics, record) => {
          if (!record.metrics) {
            return '—';
          }
          return formatPercent(record.metrics.winRatePercent);
        },
      },
      {
        title: 'P&L',
        dataIndex: 'metrics',
        key: 'pnl',
        sorter: buildMetricNumberSorter((metrics) => metrics.pnl),
        render: (_metrics, record) => (record.metrics ? formatSignedAmount(record.metrics.pnl) : '—'),
      },
      {
        title: 'P&L / риск',
        dataIndex: 'metrics',
        key: 'riskEfficiency',
        sorter: buildMetricNumberSorter((metrics) => metrics.riskEfficiency ?? null),
        render: (_metrics, record) => {
          if (!record.metrics || record.metrics.riskEfficiency === null) {
            return '—';
          }
          return formatSignedAmount(record.metrics.riskEfficiency);
        },
        onCell: () => ({
          style: { minWidth: 100 },
        }),
        onHeaderCell: () => ({
          style: { minWidth: 100 },
        }),
      },
      {
        title: 'Net / день',
        dataIndex: 'metrics',
        key: 'netPerDay',
        sorter: buildMetricNumberSorter((metrics) => metrics.avgNetPerDay),
        render: (_metrics, record) => (record.metrics ? formatSignedAmount(record.metrics.avgNetPerDay) : '—'),
      },
      {
        title: 'Акт. МПУ',
        dataIndex: 'metrics',
        key: 'activeMpu',
        sorter: buildMetricNumberSorter((metrics) => metrics.activeMpu),
        render: (_metrics, record) => (record.metrics ? formatAggregationValue(record.metrics.activeMpu) : '—'),
      },
      {
        title: 'Сделки',
        dataIndex: 'metrics',
        key: 'deals',
        sorter: buildMetricNumberSorter((metrics) => metrics.totalDeals),
        render: (_metrics, record) => (record.metrics ? formatAggregationInteger(record.metrics.totalDeals) : '—'),
      },
      {
        title: 'Avg длит. (д)',
        dataIndex: 'metrics',
        key: 'avgDuration',
        sorter: buildMetricNumberSorter((metrics) => metrics.avgTradeDurationDays),
        render: (_metrics, record) =>
          record.metrics ? `${formatAggregationValue(record.metrics.avgTradeDurationDays)} д` : '—',
      },
      {
        title: 'Дни без торговли',
        dataIndex: 'metrics',
        key: 'downtime',
        sorter: buildMetricNumberSorter((metrics) => metrics.downtimeDays),
        render: (_metrics, record) =>
          record.metrics ? `${formatAggregationValue(record.metrics.downtimeDays)} д` : '—',
      },
      {
        title: 'Макс. просадка',
        dataIndex: 'metrics',
        key: 'maxDrawdown',
        sorter: buildMetricNumberSorter((metrics) => metrics.maxDrawdown),
        render: (_metrics, record) => (record.metrics ? formatAggregationValue(record.metrics.maxDrawdown) : '—'),
      },
      {
        title: 'Макс. МПУ',
        dataIndex: 'metrics',
        key: 'maxMPU',
        sorter: buildMetricNumberSorter((metrics) => metrics.maxMPU),
        render: (_metrics, record) => (record.metrics ? formatAggregationValue(record.metrics.maxMPU) : '—'),
      },
      {
        title: 'Макс. МПП',
        dataIndex: 'metrics',
        key: 'maxMPP',
        sorter: buildMetricNumberSorter((metrics) => metrics.maxMPP),
        render: (_metrics, record) => (record.metrics ? formatAggregationValue(record.metrics.maxMPP) : '—'),
      },
    ],
    [buildMetricNumberSorter, buildMetricStringSorter],
  );

  const {
    columns: aggregationColumns,
    settings: aggregationColumnSettings,
    moveColumn: moveAggregationColumn,
    setColumnVisibility: setAggregationColumnVisibility,
    reset: resetAggregationColumns,
    hasCustomSettings: aggregationHasCustomSettings,
  } = useTableColumnSettings<AggregationItemState>({
    tableKey: 'backtests-aggregation-table',
    columns: baseAggregationColumns,
  });

  const aggregationRowClassName = useCallback((record: AggregationItemState) => {
    const classes = ['aggregation-table__row'];
    const canToggle = record.status === 'success' && Boolean(record.metrics);
    const isIncluded = canToggle && record.included;
    if (!canToggle) {
      classes.push('aggregation-table__row--inactive');
    } else if (!isIncluded) {
      classes.push('aggregation-table__row--muted');
    }
    return classes.join(' ');
  }, []);

  return (
    <div className="panel">
      <div className="panel__header">
        <div>
          <h2 className="panel__title">Детальная статистика</h2>
          <p className="panel__description">
            Соберите расширенную статистику выбранных бэктестов для анализа агрегированных метрик и одновременных
            позиций.
          </p>
        </div>
        <div className="panel__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {showGatherButton && (
            <Button
              type="primary"
              onClick={runAggregation}
              disabled={!extensionReady || aggregationState.running || cachePreloading}
              loading={aggregationState.running || cachePreloading}
            >
              {aggregationState.running ? 'Собираем…' : cachePreloading ? 'Загружаем из кеша…' : 'Собрать статистику'}
            </Button>
          )}
        </div>
      </div>

      {aggregationState.running && aggregationProgress.total > 0 && (
        <div className="run-log">
          <div className="run-log__progress">
            <span>
              Выполнено {aggregationProgress.completed} из {aggregationProgress.total}
            </span>
            <div className="progress-bar">
              <div className="progress-bar__fill" style={{ width: `${aggregationProgress.percent}%` }} />
            </div>
          </div>
        </div>
      )}

      {aggregationState.lastRunAt && !aggregationState.running && (
        <div className="panel__description" style={{ fontSize: 12, marginTop: -4 }}>
          Последний запуск: {new Date(aggregationState.lastRunAt).toLocaleString()}
        </div>
      )}

      {aggregationErrors.length > 0 && (
        <div className="run-log" style={{ marginTop: 12 }}>
          <div className="run-log__entries">
            {aggregationErrors.map((item) => (
              <div key={item.id} className="run-log__entry run-log__entry--error">
                ⚠️ {item.error}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel__section">
        {botLimit !== null && totalSelected > 0 && allMetricsReady && (
          <div className="aggregation-controls">
            <label className="aggregation-controls__label" htmlFor="aggregation-bot-limit">
              Лимит одновременно запущенных ботов
              <InfoTooltip text="Используется для моделирования влияния ограничения количества одновременно работающих ботов." />
            </label>
            <div className="aggregation-controls__inputs">
              <input
                id="aggregation-bot-limit"
                type="range"
                min={1}
                max={totalSelected}
                value={botLimit}
                onChange={(event) => setBotLimit(Number(event.target.value))}
                className="aggregation-controls__slider"
                disabled={limitDisabled}
              />
              <input
                type="number"
                min={1}
                max={totalSelected}
                value={botLimit}
                onChange={(event) => setBotLimit(Number(event.target.value))}
                className="aggregation-controls__number"
                disabled={limitDisabled}
              />
              <div className="aggregation-controls__value">
                {botLimit} из {totalSelected}
              </div>
            </div>
          </div>
        )}

        {aggregationSummary ? (
          <Tabs
            className="aggregation-tabs"
            activeTabId={activeAggregationTab}
            onTabChange={setActiveAggregationTab}
            items={
              [
                {
                  id: 'metrics',
                  label: 'Показатели',
                  content: (
                    <div className="aggregation-summary">
                      <StatisticCard
                        title="Бэктесты (Σ)"
                        tooltip={
                          <InfoTooltip text="Количество бэктестов, включённых в расчёт агрегированных показателей." />
                        }
                        value={aggregationSummary.totalSelected}
                        formatter={(raw) => formatAggregationInteger(ensureNumber(raw))}
                        trend={aggregationSummary.totalSelected > 0 ? 'neutral' : 'muted'}
                      />
                      {typeof botLimit === 'number' ? (
                        <StatisticCard
                          title="Лимит ботов"
                          tooltip={
                            <InfoTooltip text="Максимальное число ботов, учитываемое при расчёте агрегированных метрик." />
                          }
                          value={botLimit}
                          formatter={(raw) => formatAggregationInteger(ensureNumber(raw))}
                          trend="neutral"
                        />
                      ) : null}
                      <StatisticCard
                        title="P&L (Σ)"
                        tooltip={
                          <InfoTooltip text="Совокупный результат всех включённых бэктестов в выбранной валюте." />
                        }
                        value={aggregationSummary.totalPnl}
                        formatter={(raw) => formatSignedAmount(ensureNumber(raw))}
                        trend={resolveTrend(aggregationSummary.totalPnl)}
                      />
                      <StatisticCard
                        title="P&L / сделку"
                        tooltip={<InfoTooltip text="Средний результат одной сделки по всем включённым бэктестам." />}
                        value={aggregationSummary.avgPnlPerDeal}
                        formatter={(raw) => formatSignedAmount(ensureNumber(raw))}
                        trend={resolveTrend(aggregationSummary.avgPnlPerDeal)}
                      />
                      <StatisticCard
                        title="Net/день"
                        tooltip={
                          <InfoTooltip text="Средний дневной результат по всем бэктестам, включённым в агрегированную статистику." />
                        }
                        value={aggregationSummary.avgNetPerDay}
                        formatter={(raw) => formatSignedAmount(ensureNumber(raw))}
                        trend={resolveTrend(aggregationSummary.avgNetPerDay)}
                      />
                      <StatisticCard
                        title="P&L к риску"
                        tooltip={
                          <InfoTooltip text="Отношение совокупного P&L к наибольшему из значений МПУ или просадки." />
                        }
                        value={aggregationSummary.aggregateRiskEfficiency ?? Number.NaN}
                        formatter={(raw) => {
                          const numeric = ensureNumber(raw);
                          return Number.isFinite(numeric) ? formatSignedAmount(numeric) : '—';
                        }}
                        trend={resolveTrend(aggregationSummary.aggregateRiskEfficiency)}
                      />
                      <StatisticCard
                        title="Сделки (Σ)"
                        tooltip={
                          <InfoTooltip text="Количество сделок и распределение по прибыльным, убыточным и активным операциям." />
                        }
                        value={`${formatAggregationInteger(aggregationSummary.totalProfits, true)} / ${formatAggregationInteger(aggregationSummary.totalLosses, true)} / ${formatAggregationInteger(aggregationSummary.openDeals, true)}`}
                        trend={aggregationSummary.totalDeals > 0 ? 'neutral' : 'muted'}
                      />
                      <StatisticCard
                        title="Акт. МПУ"
                        tooltip={<InfoTooltip text="Совокупный МПУ по незакрытым сделкам." />}
                        value={aggregationSummary.activeMpu}
                        formatter={(raw) => formatAggregationValue(ensureNumber(raw))}
                        trend={aggregationSummary.activeMpu > 0 ? 'negative' : 'muted'}
                      />
                      <StatisticCard
                        title="Длит. сделки"
                        tooltip={
                          <InfoTooltip text="Средняя продолжительность одной сделки среди всех участников агрегированной выборки." />
                        }
                        value={aggregationSummary.avgTradeDurationDays}
                        formatter={(raw) => {
                          const numeric = ensureNumber(raw);
                          return Number.isFinite(numeric) ? `${formatAggregationValue(numeric)} д` : '—';
                        }}
                        trend="muted"
                      />
                      <StatisticCard
                        title="Дни без сделок"
                        tooltip={<InfoTooltip text="Суммарное количество дней, когда в выборке не было сделок." />}
                        value={aggregationSummary.noTradeDays}
                        formatter={(raw) => formatAggregationInteger(ensureNumber(raw))}
                        trend={aggregationSummary.noTradeDays ? 'neutral' : 'muted'}
                      />
                      <StatisticCard
                        title="Портф. просадка"
                        tooltip={<InfoTooltip text="Фактическая просадка портфеля при агрегировании всех бэктестов." />}
                        value={-Math.abs(aggregationSummary.aggregateDrawdown)}
                        formatter={(raw) => formatSignedAmount(ensureNumber(raw))}
                        trend={resolveTrend(-Math.abs(aggregationSummary.aggregateDrawdown))}
                      />
                      <StatisticCard
                        title="Портф. МПУ"
                        tooltip={
                          <InfoTooltip text="Максимальное преминимальное удержание портфеля по совокупности результатов." />
                        }
                        value={-Math.abs(aggregationSummary.aggregateMPU)}
                        formatter={(raw) => formatSignedAmount(ensureNumber(raw))}
                        trend={resolveTrend(-Math.abs(aggregationSummary.aggregateMPU))}
                      />
                    </div>
                  ),
                },
                {
                  id: 'equity',
                  label: 'Эквити портфеля',
                  content: (
                    <div className="aggregation-equity">
                      <div className="aggregation-equity__header">
                        <h3 className="aggregation-equity__title">Эквити портфеля</h3>
                        <p className="aggregation-equity__subtitle">
                          Портфельная эквити помогает оценить стабильность совокупного результата и влияет на выбор
                          оптимального лимита ботов.
                        </p>
                      </div>
                      <div className="aggregation-equity__chart">
                        {portfolioEquitySeries && portfolioEquitySeries.points.length > 0 ? (
                          <PortfolioEquityChart series={portfolioEquitySeries} className="aggregation-equity__canvas" />
                        ) : (
                          <div className="aggregation-equity__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                      <div className="aggregation-equity__metrics">
                        <StatisticCard
                          title="Финальный P&L"
                          value={portfolioFinalValue ?? Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatSignedAmount(numeric) : '—';
                          }}
                          trend={resolveTrend(portfolioFinalValue ?? Number.NaN)}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'risk',
                  label: 'Риски',
                  content: (
                    <div className="aggregation-risk">
                      <div className="aggregation-risk__header">
                        <h3 className="aggregation-risk__title">Суммарное МПУ портфеля</h3>
                        <p className="aggregation-risk__subtitle">
                          График помогает понять, насколько портфель чувствителен к просадкам и нужен ли более строгий
                          лимит.
                        </p>
                      </div>
                      <div className="aggregation-risk__metrics">
                        <StatisticCard
                          title="Пиковый МПУ"
                          value={aggregateRiskPeak !== null ? -Math.abs(aggregateRiskPeak) : Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatSignedAmount(numeric) : '—';
                          }}
                          trend={resolveTrend(aggregateRiskPeak !== null ? -Math.abs(aggregateRiskPeak) : Number.NaN)}
                        />
                      </div>
                      <div className="aggregation-risk__chart">
                        {aggregateRiskSeries && aggregateRiskSeries.points.length > 0 ? (
                          <AggregateRiskChart series={aggregateRiskSeries} className="aggregation-risk__canvas" />
                        ) : (
                          <div className="aggregation-risk__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'limit',
                  label: 'Лимит по ботам',
                  content: (
                    <div className="aggregation-limit">
                      <div className="aggregation-limit__header">
                        <h3 className="aggregation-limit__title">Как влияет лимит по ботам</h3>
                        <p className="aggregation-limit__subtitle">
                          Рассчитываем, как меняются ключевые метрики портфеля при разных ограничениях одновременно
                          работающих ботов.
                        </p>
                      </div>
                      <div className="aggregation-limit__chart">
                        {limitImpactPoints.length > 0 ? (
                          <LimitImpactChart points={limitImpactPoints} className="aggregation-limit__canvas" />
                        ) : (
                          <div className="aggregation-limit__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                      <div className="aggregation-limit__chart">
                        {limitImpactPoints.length > 0 ? (
                          <LimitRiskEfficiencyChart
                            points={limitImpactPoints}
                            className="aggregation-limit__canvas aggregation-limit__canvas--secondary"
                          />
                        ) : (
                          <div className="aggregation-limit__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'concurrency',
                  label: 'Одновременность',
                  content: (
                    <div className="aggregation-concurrency">
                      <div className="aggregation-concurrency__header">
                        <h3 className="aggregation-concurrency__title">Активные позиции по дням</h3>
                        <p className="aggregation-concurrency__subtitle">
                          Распределение дневных пиков помогает подобрать лимит одновременно открытых позиций.
                        </p>
                      </div>
                      <div className="aggregation-concurrency__metrics">
                        <StatisticCard
                          title="Средний пик"
                          tooltip={
                            <InfoTooltip text="Среднее значение дневного максимума активных позиций по совокупности бэктестов." />
                          }
                          value={dailyConcurrencyStats?.meanMax ?? Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatAggregationValue(numeric) : '—';
                          }}
                          trend="neutral"
                        />
                        <StatisticCard
                          title="P75"
                          tooltip={<InfoTooltip text="75-й перцентиль дневных максимумов активных позиций." />}
                          value={dailyConcurrencyStats?.p75 ?? Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatAggregationValue(numeric) : '—';
                          }}
                          trend="neutral"
                        />
                        <StatisticCard
                          title="P90"
                          tooltip={<InfoTooltip text="90-й перцентиль дневных максимумов активных позиций." />}
                          value={dailyConcurrencyStats?.p90 ?? Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatAggregationValue(numeric) : '—';
                          }}
                          trend="neutral"
                        />
                        <StatisticCard
                          title="P95"
                          tooltip={<InfoTooltip text="95-й перцентиль дневных максимумов активных позиций." />}
                          value={dailyConcurrencyStats?.p95 ?? Number.NaN}
                          formatter={(raw) => {
                            const numeric = ensureNumber(raw);
                            return Number.isFinite(numeric) ? formatAggregationValue(numeric) : '—';
                          }}
                          trend="neutral"
                        />
                      </div>
                      <div className="aggregation-concurrency__chart">
                        {dailyConcurrencyRecords.length > 0 ? (
                          <DailyConcurrencyChart
                            records={dailyConcurrencyRecords}
                            stats={dailyConcurrencyStats}
                            className="aggregation-concurrency__canvas"
                          />
                        ) : (
                          <div className="aggregation-concurrency__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                    </div>
                  ),
                },
              ] satisfies TabItem[]
            }
          />
        ) : (
          <div className="empty-state">
            {totalSelected === 0
              ? 'Выберите минимум один бэктест, чтобы собрать статистику.'
              : aggregationState.running
                ? 'Сбор статистики выполняется…'
                : cachePreloading
                  ? 'Загружаем статистику из кеша…'
                  : hasIncompleteItems
                    ? 'Соберите статистику, чтобы увидеть сводные метрики.'
                    : 'Все собранные бэктесты выключены в таблице ниже. Включите нужные строки, чтобы они попали в статистику.'}
          </div>
        )}

        {showAggregationTable && (
          <div className="panel__section">
            <div
              className="panel__actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                width: '100%',
              }}
            >
              {hasActionsMenu && (
                <Space style={{ marginLeft: 'auto' }}>
                  <Dropdown
                    menu={{ items: actionsMenuItems, onClick: handleActionsMenuClick }}
                    trigger={['click']}
                    disabled={aggregationState.running}
                  >
                    <Button icon={<DownOutlined />}>Действия</Button>
                  </Dropdown>
                </Space>
              )}
              <TableColumnSettingsButton
                settings={aggregationColumnSettings}
                moveColumn={moveAggregationColumn}
                setColumnVisibility={setAggregationColumnVisibility}
                reset={resetAggregationColumns}
                hasCustomSettings={aggregationHasCustomSettings}
              />
            </div>
            <div className="table-container">
              <Table<AggregationItemState>
                className="aggregation-table"
                columns={aggregationColumns}
                dataSource={aggregationItems}
                rowKey={(item) => item.id}
                rowSelection={aggregationRowSelection}
                pagination={false}
                size="small"
                rowClassName={aggregationRowClassName}
                loading={aggregationState.running}
                locale={{ emptyText: 'Нет данных для отображения.' }}
                scroll={{ x: true }}
              />
            </div>
          </div>
        )}
      </div>

      <CreateBotsFromBacktestsModal
        open={botCreationOpen}
        targets={botCreationTargets}
        onClose={handleBotCreationClose}
      />
    </div>
  );
};

export default BacktestAggregationPanel;
