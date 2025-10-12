import { DownOutlined } from '@ant-design/icons';
import type { MenuProps, TableProps } from 'antd';
import { Dropdown, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CYCLES_PAGE_SIZE, fetchBacktestCycles, fetchBacktestDetails, fetchBacktests } from '../api/backtests';
import CreateBotsFromBacktestsModal, { type BacktestBotTarget } from '../components/CreateBotsFromBacktestsModal';
import { AggregateRiskChart } from '../components/charts/AggregateRiskChart';
import { DailyConcurrencyChart } from '../components/charts/DailyConcurrencyChart';
import { LimitImpactChart } from '../components/charts/LimitImpactChart';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { type TabItem, Tabs } from '../components/ui/Tabs';
import {
  type AggregationSummary,
  type BacktestAggregationMetrics,
  computeBacktestMetrics,
  summarizeAggregations,
} from '../lib/backtestAggregation';
import { readCachedBacktestCycles, readCachedBacktestDetail } from '../storage/backtestCache';
import type { BacktestStatistics, BacktestStatisticsDetail, BacktestStatisticsListResponse } from '../types/backtests';

interface BacktestsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SORT = 'date,desc';

const logBacktestsError = (context: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[Backtests] ${context}: ${message}`, error);
  }
  return message;
};

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const durationFormatter = (value: number | null) => {
  if (value === null) {
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

const formatAmount = (value: number | null, suffix?: string) => {
  if (value === null) {
    return '—';
  }
  return `${numberFormatter.format(value)}${suffix ? ` ${suffix}` : ''}`;
};

const formatPercent = (value: number | null) => {
  if (value === null) {
    return '—';
  }
  return `${percentageFormatter.format(value)}%`;
};

const formatLeverage = (value: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return `${numberFormatter.format(value)}x`;
};

const formatDateRu = (value: string | null | undefined) => {
  if (!value) {
    return '—';
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return '—';
  }
  return new Date(timestamp).toLocaleDateString('ru-RU');
};

const resolveDealCount = (value: number | null): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
};

const formatWinRate = (wins: number | null, losses: number | null) => {
  const winsCount = resolveDealCount(wins);
  const lossesCount = resolveDealCount(losses);
  const completedDeals = winsCount + lossesCount;
  if (completedDeals <= 0) {
    return '—';
  }
  return formatPercent((winsCount / completedDeals) * 100);
};

const formatLossRate = (losses: number | null, wins: number | null) => {
  const lossesCount = resolveDealCount(losses);
  const winsCount = resolveDealCount(wins);
  const completedDeals = winsCount + lossesCount;
  if (completedDeals <= 0) {
    return '—';
  }
  return formatPercent((lossesCount / completedDeals) * 100);
};

type AggregationStatus = 'idle' | 'loading' | 'success' | 'error';

interface AggregationItemState {
  id: number;
  status: AggregationStatus;
  included: boolean;
  metrics?: BacktestAggregationMetrics;
  detail?: BacktestStatisticsDetail;
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

const formatAggregationInteger = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return aggregationIntegerFormatter.format(value);
};

const BacktestsPage = ({ extensionReady }: BacktestsPageProps) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const sort = DEFAULT_SORT;
  const [data, setData] = useState<BacktestStatisticsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<BacktestStatistics[]>([]);
  const [aggregationState, setAggregationState] = useState<AggregationState>({
    items: new Map(),
    running: false,
    total: 0,
    completed: 0,
    lastRunAt: null,
  });
  const [activeAggregationTab, setActiveAggregationTab] = useState<string>('metrics');
  const [botLimit, setBotLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!extensionReady) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    fetchBacktests({ page, size: pageSize, sort })
      .then((response) => {
        if (!isActive) {
          return;
        }
        setData(response);
      })
      .catch((requestError: unknown) => {
        if (!isActive) {
          return;
        }
        const message = logBacktestsError('Не удалось загрузить список бэктестов', requestError);
        setError(message);
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [extensionReady, page, pageSize, sort]);

  useEffect(() => {
    if (!extensionReady) {
      setSelection([]);
      setAggregationState({
        items: new Map(),
        running: false,
        total: 0,
        completed: 0,
        lastRunAt: null,
      });
    }
  }, [extensionReady]);

  const items = data?.content ?? [];
  const totalElements = data?.totalElements ?? items.length;
  const totalSelected = selection.length;

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

  const handleBotLimitChange = useCallback(
    (nextValue: number) => {
      if (totalSelected === 0) {
        setBotLimit(null);
        return;
      }
      const maxAllowed = totalSelected;
      const clamped = Math.min(Math.max(Math.floor(nextValue), 1), maxAllowed);
      setBotLimit((previous) => {
        if (previous === clamped) {
          return previous;
        }
        return clamped;
      });
    },
    [totalSelected],
  );

  const selectedRowKeys = useMemo(() => selection.map((s) => s.id), [selection]);

  const rowSelection: TableRowSelection<BacktestStatistics> = {
    selectedRowKeys,
    type: 'checkbox',
    preserveSelectedRowKeys: true,
    onChange: (_nextSelectedRowKeys, nextSelectedRows) => {
      setSelection(nextSelectedRows);
    },
  };

  const handleTableChange = useCallback<NonNullable<TableProps<BacktestStatistics>['onChange']>>(
    (pagination) => {
      const nextPageSize = pagination?.pageSize ?? pageSize;
      const pageIndex = Math.max((pagination?.current ?? 1) - 1, 0);
      const isPageSizeChanged = nextPageSize !== pageSize;

      if (isPageSizeChanged) {
        setPageSize(nextPageSize);
        setPage(0);
      } else {
        setPage(pageIndex);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    setAggregationState((prev) => {
      const nextItems = new Map<number, AggregationItemState>();
      selection.forEach(({ id }) => {
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
  }, [selection]);

  const columns: ColumnsType<BacktestStatistics> = useMemo(
    () => [
      {
        title: 'Название',
        dataIndex: 'name',
        key: 'name',
        width: 240,
        fixed: 'left',
        render: (_value, item) => (
          <div>
            <div>{item.name}</div>
            <div className="panel__description">
              ID:{' '}
              <a href={`https://veles.finance/cabinet/backtests/${item.id}`} target="_blank" rel="noreferrer noopener">
                {item.id}
              </a>
            </div>
          </div>
        ),
      },
      {
        title: 'Период',
        dataIndex: 'date',
        key: 'date',
        render: (_value, item) => (
          <div>
            <div>{formatDateRu(item.from)}</div>
            <div className="panel__description">до {formatDateRu(item.to)}</div>
          </div>
        ),
      },
      {
        title: 'Биржа',
        dataIndex: 'exchange',
        key: 'exchange',
      },
      {
        title: 'Пара',
        dataIndex: 'symbol',
        key: 'symbol',
        render: (_value, item) => (
          <div>
            <div>{item.symbol}</div>
            <div className="panel__description">{item.algorithm}</div>
          </div>
        ),
      },
      {
        title: 'Прибыль',
        dataIndex: 'profitQuote',
        key: 'profitQuote',
        render: (_value, item) => (
          <div>
            <div>{formatAmount(item.profitQuote, item.quote)}</div>
            <div className="panel__description">Base: {formatAmount(item.profitBase, item.base)}</div>
          </div>
        ),
      },
      {
        title: 'Net / день',
        dataIndex: 'netQuote',
        key: 'netQuote',
        render: (_value, item) => (
          <div>
            <div>{formatAmount(item.netQuote, item.quote)}</div>
            <div className="panel__description">в день: {formatAmount(item.netQuotePerDay, item.quote)}</div>
          </div>
        ),
      },
      {
        title: 'Число сделок',
        dataIndex: 'totalDeals',
        key: 'totalDeals',
        render: (_value, item) => (
          <div>
            <div>{item.totalDeals ?? '—'}</div>
            <div className="panel__description">
              P/L/B: {item.profits ?? 0}/{item.losses ?? 0}/{item.breakevens ?? 0}
            </div>
          </div>
        ),
      },
      {
        title: 'Win rate',
        dataIndex: 'winRateProfits',
        key: 'winRate',
        render: (_value, item) => {
          const winRateValue = formatWinRate(item.winRateProfits ?? item.profits, item.winRateLosses ?? item.losses);
          const lossRateValue = formatLossRate(item.winRateLosses ?? item.losses, item.winRateProfits ?? item.profits);
          return (
            <div>
              <div>{winRateValue}</div>
              <div className="panel__description">Loss: {lossRateValue}</div>
            </div>
          );
        },
      },
      {
        title: 'МПУ',
        dataIndex: 'maeAbsolute',
        key: 'maeAbsolute',
        render: (_value, item) => (
          <div>
            <div>{formatAmount(item.maeAbsolute, item.quote)}</div>
            <div className="panel__description">{formatPercent(item.maePercent)}</div>
          </div>
        ),
      },
      {
        title: 'МПП',
        dataIndex: 'mfeAbsolute',
        key: 'mfeAbsolute',
        render: (_value, item) => (
          <div>
            <div>{formatAmount(item.mfeAbsolute, item.quote)}</div>
            <div className="panel__description">{formatPercent(item.mfePercent)}</div>
          </div>
        ),
      },
      {
        title: 'Макс время в сделке',
        dataIndex: 'maxDuration',
        key: 'maxDuration',
        render: (_value, item) => durationFormatter(item.maxDuration),
      },
      {
        title: 'Среднее время в сделке',
        dataIndex: 'avgDuration',
        key: 'avgDuration',
        render: (_value, item) => durationFormatter(item.avgDuration),
      },
    ],
    [],
  );

  const tablePagination = useMemo(
    () => ({
      current: page + 1,
      pageSize,
      total: totalElements,
      showSizeChanger: true,
      pageSizeOptions: PAGE_SIZE_OPTIONS.map((option) => String(option)),
      showTotal: (total: number, range: [number, number]) => `${range[0]}–${range[1]} из ${total}`,
    }),
    [page, pageSize, totalElements],
  );

  const aggregationItems = useMemo(() => Array.from(aggregationState.items.values()), [aggregationState.items]);

  const includedActionableTargets = useMemo<BacktestBotTarget[]>(
    () =>
      aggregationItems
        .filter((item) => item.status === 'success' && item.included && item.detail)
        .map((item) => ({
          id: item.id,
          detail: item.detail as BacktestStatisticsDetail,
        })),
    [aggregationItems],
  );

  const [botCreationOpen, setBotCreationOpen] = useState(false);
  const [botCreationTargets, setBotCreationTargets] = useState<BacktestBotTarget[]>([]);

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

  const botActionsMenu = useMemo<MenuProps>(
    () => ({
      items: [
        {
          key: 'create-bots',
          label: 'Создать ботов',
          disabled: includedActionableTargets.length === 0,
        },
      ],
      onClick: ({ key }) => {
        if (key === 'create-bots') {
          handleOpenBotCreation();
        }
      },
    }),
    [handleOpenBotCreation, includedActionableTargets.length],
  );

  const pendingCachedEntries = useMemo(() => {
    const entries: Array<[number, BacktestStatistics]> = [];
    selection.forEach((summary, id) => {
      const stateItem = aggregationState.items.get(id);
      if (!stateItem || stateItem.status !== 'idle' || stateItem.metrics) {
        return;
      }
      entries.push([id, summary]);
    });
    return entries;
  }, [selection, aggregationState.items]);

  useEffect(() => {
    if (pendingCachedEntries.length === 0) {
      return;
    }

    let cancelled = false;

    const preloadFromCache = async () => {
      for (const [id, summary] of pendingCachedEntries) {
        if (cancelled) {
          return;
        }

        const detail = await readCachedBacktestDetail(id);
        if (!detail) {
          continue;
        }

        const from = summary.from ?? detail.from ?? null;
        const to = summary.to ?? detail.to ?? null;

        const cycles = await readCachedBacktestCycles(id, {
          from,
          to,
          pageSize: DEFAULT_CYCLES_PAGE_SIZE,
        });
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

    void preloadFromCache();

    return () => {
      cancelled = true;
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

  const hasFetchedMetrics = collectedItems.length > 0;
  const canAdjustLimit = includedMetrics.length > 0;
  const limitDisabled = !canAdjustLimit || aggregationState.running;

  const aggregationSummary = useMemo<AggregationSummary | null>(() => {
    if (includedMetrics.length === 0) {
      return null;
    }
    const limit = botLimit;
    return summarizeAggregations(includedMetrics, typeof limit === 'number' ? { maxConcurrentBots: limit } : undefined);
  }, [includedMetrics, botLimit]);

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
    if (includedMetrics.length === 0) {
      return [];
    }

    const metricsList = includedMetrics;
    const total = metricsList.length;
    if (total === 0) {
      return [];
    }

    const items = [] as {
      label: string;
      totalPnl: number;
      aggregateDrawdown: number;
      aggregateMPU: number;
    }[];

    for (let limit = 1; limit <= total; limit += 1) {
      const summary = summarizeAggregations(metricsList, {
        maxConcurrentBots: limit,
      });
      items.push({
        label: `${limit}`,
        totalPnl: summary.totalPnl,
        aggregateDrawdown: summary.aggregateDrawdown,
        aggregateMPU: summary.aggregateMPU,
      });
    }

    const unlimitedSummary = summarizeAggregations(metricsList);
    items.push({
      label: '∞',
      totalPnl: unlimitedSummary.totalPnl,
      aggregateDrawdown: unlimitedSummary.aggregateDrawdown,
      aggregateMPU: unlimitedSummary.aggregateMPU,
    });

    return items;
  }, [includedMetrics]);

  const resolveTrendClass = (value: number): string => {
    if (!Number.isFinite(value) || Math.abs(value) <= 1e-9) {
      return 'aggregation-metric__value aggregation-metric__value--neutral';
    }
    return `aggregation-metric__value ${value > 0 ? 'aggregation-metric__value--positive' : 'aggregation-metric__value--negative'}`;
  };

  const runAggregation = async () => {
    if (aggregationState.running) {
      return;
    }
    const targets = selection.map((s) => s.id);
    if (targets.length === 0) {
      return;
    }

    setAggregationState((prev) => {
      const nextItems = new Map(prev.items);
      targets.forEach((id) => {
        const existing = nextItems.get(id);
        nextItems.set(id, {
          id,
          status: 'loading',
          included: existing?.included ?? true,
          metrics: existing?.metrics,
          error: undefined,
        });
      });
      return {
        ...prev,
        items: nextItems,
        running: true,
        total: targets.length,
        completed: 0,
        lastRunAt: null,
      };
    });

    try {
      for (const id of targets) {
        try {
          const details = await fetchBacktestDetails(id);
          const cycles = await fetchBacktestCycles(id);
          const metrics = computeBacktestMetrics(details, cycles);
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
              detail: details,
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

  const resetAggregation = () => {
    const nextItems = new Map<number, AggregationItemState>();
    selection.forEach((stat) => {
      nextItems.set(stat.id, { id: stat.id, status: 'idle', included: true });
    });
    setAggregationState({
      items: nextItems,
      running: false,
      total: 0,
      completed: 0,
      lastRunAt: null,
    });
  };

  const aggregationSelectedRowKeys = useMemo(
    () =>
      aggregationItems
        .filter((item) => item.status === 'success' && item.metrics && item.included)
        .map((item) => item.id),
    [aggregationItems],
  );

  const handleAggregationSelectionChange = (_newSelectedRowKeys: Key[], nextSelectedRows: AggregationItemState[]) => {
    const selectedIds = new Set<number>(nextSelectedRows.map((r) => r.id));

    setAggregationState((prev) => {
      let changed = false;
      const nextItems = new Map<number, AggregationItemState>();

      prev.items.forEach((item, key) => {
        if (item.status === 'success' && item.metrics) {
          const shouldInclude = selectedIds.has(key);
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

  const resolveSortableNumber = (value: number | null | undefined): number => {
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  };

  const buildMetricNumberSorter =
    (selector: (metrics: BacktestAggregationMetrics) => number | null | undefined) =>
    (a: AggregationItemState, b: AggregationItemState) => {
      const aValue = resolveSortableNumber(a.metrics ? selector(a.metrics) : null);
      const bValue = resolveSortableNumber(b.metrics ? selector(b.metrics) : null);
      return aValue - bValue;
    };

  const buildMetricStringSorter =
    (selector: (metrics: BacktestAggregationMetrics) => string | null | undefined) =>
    (a: AggregationItemState, b: AggregationItemState) => {
      const aValue = a.metrics ? (selector(a.metrics) ?? '') : '';
      const bValue = b.metrics ? (selector(b.metrics) ?? '') : '';
      return aValue.localeCompare(bValue, 'ru');
    };

  const aggregationColumns: ColumnsType<AggregationItemState> = [
    {
      title: 'Бэктест',
      key: 'name',
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
            <a href={`https://veles.finance/cabinet/backtests/${record.id}`} target="_blank" rel="noreferrer noopener">
              {record.id}
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Пара',
      dataIndex: 'metrics',
      key: 'symbol',
      sorter: buildMetricStringSorter((metrics) => metrics.symbol),
      render: (_metrics, record) => record.metrics?.symbol ?? '—',
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
      title: 'Net / день',
      dataIndex: 'metrics',
      key: 'netPerDay',
      sorter: buildMetricNumberSorter((metrics) => metrics.avgNetPerDay),
      render: (_metrics, record) => (record.metrics ? formatSignedAmount(record.metrics.avgNetPerDay) : '—'),
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
      render: (_metrics, record) => (record.metrics ? `${formatAggregationValue(record.metrics.downtimeDays)} д` : '—'),
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
  ];

  const aggregationRowClassName = useCallback((record: AggregationItemState) => {
    const classes = ['aggregation-table__row'];
    const canToggle = record.status === 'success' && Boolean(record.metrics);
    const isIncluded = canToggle && record.included;
    if (!isIncluded) {
      classes.push('aggregation-table__row--inactive');
    }
    return classes.join(' ');
  }, []);

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Бэктесты</h1>
        <p className="page__subtitle">
          Журнал завершённых бэктестов с ключевыми метриками, пагинацией и возможностью выбирать результаты для
          дальнейшей обработки.
        </p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение Veles Tools неактивно. Запустите интерфейс из меню расширения, чтобы загрузить список бэктестов.
        </div>
      )}

      <div className="panel">
        <div className="table-container">
          <Table<BacktestStatistics>
            columns={columns}
            dataSource={items}
            rowKey={(item) => item.id}
            pagination={tablePagination}
            rowSelection={rowSelection}
            loading={loading}
            onChange={handleTableChange}
            scroll={{ x: 1400 }}
            size="middle"
            locale={{
              emptyText: loading ? 'Загружаем данные…' : 'Нет данных для отображения.',
            }}
            sticky
          />
        </div>

        {error && <div className="banner banner--warning">Ошибка загрузки: {error}</div>}
      </div>

      <div className="panel">
        <h2 className="panel__title">Выбранные бэктесты</h2>
        <p className="panel__description">
          Эти результаты будут использоваться для дальнейшего анализа и интеграции с мультизапуском.
        </p>
        {totalSelected === 0 ? (
          <div className="empty-state">Выберите один или несколько бэктестов в таблице.</div>
        ) : (
          <ul className="panel__list--compact">
            {selection.map((item) => (
              <li key={item.id}>
                <span className="chip">
                  <strong>{item.name}</strong>
                  <span>
                    <a
                      href={`https://veles.finance/cabinet/backtests/${item.id}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      ID: {item.id}
                    </a>
                    {' · '}
                    {item.symbol}
                  </span>
                </span>
                <span
                  style={{
                    marginLeft: 8,
                    color: '#94a3b8',
                  }}
                >
                  {formatAmount(item.profitQuote, item.quote)}
                </span>
                {item.netQuote !== null && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: '#94a3b8',
                    }}
                  >
                    Net: {formatAmount(item.netQuote, item.quote)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Детальная статистика</h2>
            <p className="panel__description">
              Соберите расширенную статистику выбранных бэктестов для анализа агрегированных метрик и одновременных
              позиций.
            </p>
          </div>
          <div className="panel__actions">
            <Dropdown
              menu={botActionsMenu}
              trigger={['click']}
              disabled={aggregationState.running || includedActionableTargets.length === 0}
            >
              <button type="button" className="button button--ghost">
                Действия <DownOutlined style={{ marginLeft: 6 }} />
              </button>
            </Dropdown>
            <button
              type="button"
              className="button button--ghost"
              onClick={resetAggregation}
              disabled={(aggregationItems.length === 0 && !aggregationState.running) || aggregationState.running}
            >
              Очистить статистику
            </button>
            <button
              type="button"
              className="button"
              onClick={runAggregation}
              disabled={!extensionReady || aggregationState.running || totalSelected === 0}
            >
              {aggregationState.running ? 'Собираем…' : 'Собрать статистику'}
            </button>
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
          <div className="banner banner--warning">
            <div>Ошибки при сборе статистики:</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {aggregationErrors.map((item) => (
                <li key={item.id}>
                  ID {item.id}: {item.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {botLimit !== null && totalSelected > 0 && (
          <div className="aggregation-controls">
            <label className="aggregation-controls__label" htmlFor="aggregation-bot-limit">
              Блокировка по ботам
              <InfoTooltip text="Максимальное количество ботов, которые могут вести сделки одновременно. Если все слоты заняты, новые сделки будут пропущены до освобождения места." />
            </label>
            <div className="aggregation-controls__inputs">
              <input
                id="aggregation-bot-limit"
                type="range"
                min={1}
                max={totalSelected}
                value={botLimit}
                onChange={(event) => handleBotLimitChange(Number(event.target.value))}
                className="aggregation-controls__slider"
                disabled={limitDisabled}
              />
              <input
                type="number"
                min={1}
                max={totalSelected}
                value={botLimit}
                onChange={(event) => handleBotLimitChange(Number(event.target.value))}
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
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Бэктестов в статистике
                          <InfoTooltip text="Количество бэктестов, включённых в расчёт агрегированных показателей." />
                        </div>
                        <div className="aggregation-metric__value">
                          {formatAggregationInteger(aggregationSummary.totalSelected)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Суммарный P&amp;L
                          <InfoTooltip text="Совокупный результат всех включённых бэктестов в выбранной валюте." />
                        </div>
                        <div className={resolveTrendClass(aggregationSummary.totalPnl)}>
                          {formatSignedAmount(aggregationSummary.totalPnl)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Avg P&amp;L / сделка
                          <InfoTooltip text="Средний результат одной сделки по всем включённым бэктестам." />
                        </div>
                        <div className={resolveTrendClass(aggregationSummary.avgPnlPerDeal)}>
                          {formatSignedAmount(aggregationSummary.avgPnlPerDeal)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Avg P&amp;L / бэктест
                          <InfoTooltip text="Средний итог на один бэктест в агрегированной выборке." />
                        </div>
                        <div className={resolveTrendClass(aggregationSummary.avgPnlPerBacktest)}>
                          {formatSignedAmount(aggregationSummary.avgPnlPerBacktest)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Средняя эффективность (Net/день)
                          <InfoTooltip text="Средний дневной результат по всем бэктестам, включённым в агрегированную статистику." />
                        </div>
                        <div className={resolveTrendClass(aggregationSummary.avgNetPerDay)}>
                          {formatSignedAmount(aggregationSummary.avgNetPerDay)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Сделки (P/L/Σ)
                          <InfoTooltip text="Количество сделок и распределение по прибыльным, убыточным и нейтральным операциям." />
                        </div>
                        <div className="aggregation-metric__value aggregation-metric__value--muted">
                          {formatAggregationInteger(aggregationSummary.totalDeals)}
                          <span className="aggregation-metric__sub">
                            {' '}
                            P:
                            {formatAggregationInteger(aggregationSummary.totalProfits)} / L:
                            {formatAggregationInteger(aggregationSummary.totalLosses)}
                          </span>
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Средняя длительность сделки (дни)
                          <InfoTooltip text="Средняя продолжительность сделок в днях среди включённых бэктестов." />
                        </div>
                        <div className="aggregation-metric__value">
                          {formatAggregationValue(aggregationSummary.avgTradeDurationDays)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Средняя макс. просадка
                          <InfoTooltip text="Средняя максимальная просадка по каждому бэктесту; отрицательные значения указывают глубину падения." />
                        </div>
                        <div className={resolveTrendClass(-Math.abs(aggregationSummary.avgMaxDrawdown))}>
                          {formatAggregationValue(aggregationSummary.avgMaxDrawdown)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Макс. суммарная просадка
                          <InfoTooltip text="Максимальное падение совокупного портфеля, составленного из всех включённых бэктестов. Это максимальный зафиксированный убыток от вашего портфеля в какой то момент бектеста. Например при срабатывании нескольких стопов подряд." />
                        </div>
                        <div className={resolveTrendClass(-Math.abs(aggregationSummary.aggregateDrawdown))}>
                          {formatAggregationValue(aggregationSummary.aggregateDrawdown)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Макс. суммарное МПУ
                          <InfoTooltip text="Максимальная одновременная просадка по всем бэктестам, учитывая пересечения сделок. Такое значение нереализованного P&L вы бы увидели в самый худший день за период бектестов" />
                        </div>
                        <div className={resolveTrendClass(-Math.abs(aggregationSummary.aggregateMPU))}>
                          {formatAggregationValue(aggregationSummary.aggregateMPU)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Макс. одновременно открытых
                          <InfoTooltip text="Пиковое количество одновременных позиций в любой день по всем бэктестам." />
                        </div>
                        <div className="aggregation-metric__value">
                          {formatAggregationInteger(aggregationSummary.maxConcurrent)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Среднее одновременно открытых
                          <InfoTooltip text="Среднее число одновременных позиций за весь период наблюдений." />
                        </div>
                        <div className="aggregation-metric__value">
                          {formatAggregationValue(aggregationSummary.avgConcurrent)}
                        </div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          Дни без торговли
                          <InfoTooltip text="Количество дней без сделок в совокупном календаре выбранных бэктестов." />
                        </div>
                        <div className="aggregation-metric__value">
                          {formatAggregationValue(aggregationSummary.noTradeDays)}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'portfolio-equity',
                  label: 'P&L портфеля',
                  content: (
                    <div className="aggregation-equity">
                      <div className="aggregation-equity__header">
                        <h3 className="aggregation-equity__title">Суммарный P&L портфеля</h3>
                        <p className="aggregation-equity__subtitle">
                          Чёрная линия показывает изменение совокупного результата выбранных бэктестов.
                        </p>
                      </div>
                      <div className="aggregation-equity__metrics">
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            Итоговый P&L
                            <InfoTooltip text="Значение последней точки кривой портфельного P&L на основе выбранных бэктестов." />
                          </div>
                          <div
                            className={
                              portfolioFinalValue !== null
                                ? resolveTrendClass(portfolioFinalValue)
                                : 'aggregation-metric__value aggregation-metric__value--muted'
                            }
                          >
                            {portfolioFinalValue !== null ? formatSignedAmount(portfolioFinalValue) : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="aggregation-equity__chart">
                        {portfolioEquitySeries && portfolioEquitySeries.points.length > 0 ? (
                          <PortfolioEquityChart series={portfolioEquitySeries} className="aggregation-equity__canvas" />
                        ) : (
                          <div className="aggregation-equity__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'aggregate-risk',
                  label: 'Суммарное МПУ',
                  content: (
                    <div className="aggregation-risk">
                      <div className="aggregation-risk__header">
                        <h3 className="aggregation-risk__title">Суммарное МПУ портфеля</h3>
                        <p className="aggregation-risk__subtitle">
                          График показывает, как менялась совокупная потенциальная просадка по выбранным бэктестам.
                        </p>
                      </div>
                      <div className="aggregation-risk__metrics">
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            Пиковое суммарное МПУ
                            <InfoTooltip text="Максимальная совокупная просадка (MPU) в любой момент времени по всем выбранным бэктестам." />
                          </div>
                          <div
                            className={
                              aggregateRiskPeak !== null
                                ? resolveTrendClass(-Math.abs(aggregateRiskPeak))
                                : 'aggregation-metric__value aggregation-metric__value--muted'
                            }
                          >
                            {aggregateRiskPeak !== null ? formatAggregationValue(aggregateRiskPeak) : '—'}
                          </div>
                        </div>
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
                  id: 'limit-impact',
                  label: 'Влияние лимита',
                  content: (
                    <div className="aggregation-limit">
                      <div className="aggregation-limit__header">
                        <h3 className="aggregation-limit__title">Как влияет лимит по ботам</h3>
                        <p className="aggregation-limit__subtitle">
                          Сравниваем итоговый P&amp;L, максимальную совокупную просадку и МПУ при разных ограничениях на
                          количество ботов.
                        </p>
                      </div>
                      <div className="aggregation-limit__chart">
                        {limitImpactPoints.length > 0 ? (
                          <LimitImpactChart points={limitImpactPoints} className="aggregation-limit__canvas" />
                        ) : (
                          <div className="aggregation-limit__empty">Нет данных для построения графика.</div>
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'daily-concurrency',
                  label: 'Активные позиции',
                  content: (
                    <div className="aggregation-concurrency">
                      <div className="aggregation-concurrency__header">
                        <h3 className="aggregation-concurrency__title">Активные позиции по дням</h3>
                        <p className="aggregation-concurrency__subtitle">
                          Распределение дневных пиков помогает подобрать лимит одновременно открытых позиций.
                        </p>
                      </div>
                      <div className="aggregation-concurrency__metrics">
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            Средний дневной пик
                            <InfoTooltip text="Среднее значение дневного максимума активных позиций по совокупности бэктестов." />
                          </div>
                          <div className="aggregation-metric__value">
                            {formatAggregationValue(dailyConcurrencyStats?.meanMax ?? 0)}
                          </div>
                        </div>
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            P75
                            <InfoTooltip text="75-й перцентиль дневных максимумов активных позиций." />
                          </div>
                          <div className="aggregation-metric__value">
                            {formatAggregationValue(dailyConcurrencyStats?.p75 ?? 0)}
                          </div>
                        </div>
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            P90
                            <InfoTooltip text="90-й перцентиль дневных максимумов активных позиций." />
                          </div>
                          <div className="aggregation-metric__value">
                            {formatAggregationValue(dailyConcurrencyStats?.p90 ?? 0)}
                          </div>
                        </div>
                        <div className="aggregation-metric">
                          <div className="aggregation-metric__label">
                            P95
                            <InfoTooltip text="95-й перцентиль дневных максимумов активных позиций." />
                          </div>
                          <div className="aggregation-metric__value">
                            {formatAggregationValue(dailyConcurrencyStats?.p95 ?? 0)}
                          </div>
                        </div>
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
                : hasFetchedMetrics
                  ? 'Все собранные бэктесты выключены в таблице ниже. Включите нужные строки, чтобы они попали в статистику.'
                  : 'Соберите статистику, чтобы увидеть сводные метрики.'}
          </div>
        )}

        {aggregationItems.length > 0 && (
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
        )}
      </div>

      <CreateBotsFromBacktestsModal
        open={botCreationOpen}
        targets={botCreationTargets}
        onClose={handleBotCreationClose}
      />
    </section>
  );
};

export default BacktestsPage;
