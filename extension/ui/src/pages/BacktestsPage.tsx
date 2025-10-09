import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DEFAULT_CYCLES_PAGE_SIZE, fetchBacktests, fetchBacktestCycles, fetchBacktestDetails } from '../api/backtests';
import type { BacktestStatistics, BacktestStatisticsListResponse } from '../types/backtests';
import {
  computeBacktestMetrics,
  summarizeAggregations,
  type AggregationSummary,
  type BacktestAggregationMetrics,
} from '../lib/backtestAggregation';
import { DailyConcurrencyChart } from '../components/charts/DailyConcurrencyChart';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { Tabs, type TabItem } from '../components/ui/Tabs';
import { readCachedBacktestCycles, readCachedBacktestDetail } from '../storage/backtestCache';

interface BacktestsPageProps {
  extensionReady: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_SORT = 'date,desc';

type SelectionMap = Map<number, BacktestSelection>;

interface BacktestSelection {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  quote: string;
  profitQuote: number | null;
  netQuote: number | null;
  from?: string | null;
  to?: string | null;
}

const createSummary = (item: BacktestStatistics): BacktestSelection => ({
  id: item.id,
  name: item.name,
  symbol: item.symbol,
  exchange: item.exchange,
  quote: item.quote,
  profitQuote: item.profitQuote,
  netQuote: item.netQuote,
  from: item.from,
  to: item.to,
});

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

type AggregationStatus = 'idle' | 'loading' | 'success' | 'error';

interface AggregationItemState {
  id: number;
  status: AggregationStatus;
  included: boolean;
  metrics?: BacktestAggregationMetrics;
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
  const [selection, setSelection] = useState<SelectionMap>(new Map());
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const [aggregationState, setAggregationState] = useState<AggregationState>({
    items: new Map(),
    running: false,
    total: 0,
    completed: 0,
    lastRunAt: null,
  });
  const [activeAggregationTab, setActiveAggregationTab] = useState<string>('metrics');

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
      setSelection(new Map());
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
  const totalPages = data?.totalPages ?? 0;
  const totalSelected = selection.size;

  const currentPageSelectedCount = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return items.filter((item) => selection.has(item.id)).length;
  }, [items, selection]);

  const allCurrentSelected = items.length > 0 && currentPageSelectedCount === items.length;
  const someCurrentSelected = currentPageSelectedCount > 0 && currentPageSelectedCount < items.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someCurrentSelected;
    }
  }, [someCurrentSelected, allCurrentSelected]);

  useEffect(() => {
    setAggregationState((prev) => {
      const nextItems = new Map<number, AggregationItemState>();
      selection.forEach((_, id) => {
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

  const toggleSelection = (item: BacktestStatistics) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, createSummary(item));
      }
      return next;
    });
  };

  const toggleCurrentPageSelection = (checked: boolean) => {
    setSelection((prev) => {
      const next = new Map(prev);
      if (!checked) {
        items.forEach((item) => {
          next.delete(item.id);
        });
        return next;
      }

      items.forEach((item) => {
        next.set(item.id, createSummary(item));
      });
      return next;
    });
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((current) => {
      if (direction === 'prev') {
        return Math.max(current - 1, 0);
      }
      if (!data) {
        return current + 1;
      }
      return Math.min(current + 1, Math.max(data.totalPages - 1, 0));
    });
  };

  const handlePageSizeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value) || PAGE_SIZE_OPTIONS[0];
    setPageSize(value);
    setPage(0);
  };

  const aggregationItems = useMemo(() => Array.from(aggregationState.items.values()), [aggregationState.items]);

  const pendingCachedEntries = useMemo(() => {
    const entries: Array<[number, BacktestSelection]> = [];
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

        const cycles = await readCachedBacktestCycles(id, { from, to, pageSize: DEFAULT_CYCLES_PAGE_SIZE });
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
    () =>
      collectedItems
        .filter((item) => item.included)
        .map((item) => item.metrics as BacktestAggregationMetrics),
    [collectedItems],
  );

  const hasFetchedMetrics = collectedItems.length > 0;

  const aggregationSummary = useMemo<AggregationSummary | null>(() => {
    if (includedMetrics.length === 0) {
      return null;
    }
    return summarizeAggregations(includedMetrics);
  }, [includedMetrics]);

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

  const portfolioEquitySeries = aggregationSummary?.portfolioEquity ?? null;
  const portfolioFinalValue = useMemo(() => {
    if (!portfolioEquitySeries || portfolioEquitySeries.points.length === 0) {
      return null;
    }
    const lastPoint = portfolioEquitySeries.points[portfolioEquitySeries.points.length - 1];
    return lastPoint.value;
  }, [portfolioEquitySeries]);

  const resolveTrendClass = (value: number): string => {
    if (!Number.isFinite(value) || Math.abs(value) <= 1e-9) {
      return 'aggregation-metric__value aggregation-metric__value--neutral';
    }
    return `aggregation-metric__value ${value > 0 ? 'aggregation-metric__value--positive' : 'aggregation-metric__value--negative'}`;
  };

  const resolveStatusLabel = (item: AggregationItemState): string => {
    switch (item.status) {
      case 'loading':
        return 'Собирается…';
      case 'success':
        return 'Собрано';
      case 'error':
        return item.error ? `Ошибка: ${item.error}` : 'Ошибка';
      default:
        return 'Ожидает запуска';
    }
  };

  const resolveStatusTone = (status: AggregationStatus): string => {
    if (status === 'success') {
      return 'aggregation-status aggregation-status--success';
    }
    if (status === 'error') {
      return 'aggregation-status aggregation-status--error';
    }
    if (status === 'loading') {
      return 'aggregation-status aggregation-status--loading';
    }
    return 'aggregation-status aggregation-status--idle';
  };

  const runAggregation = async () => {
    if (aggregationState.running) {
      return;
    }
    const targets = Array.from(selection.keys());
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
    selection.forEach((_, id) => {
      nextItems.set(id, { id, status: 'idle', included: true });
    });
    setAggregationState({
      items: nextItems,
      running: false,
      total: 0,
      completed: 0,
      lastRunAt: null,
    });
  };

  const toggleAggregationInclude = (id: number) => {
    setAggregationState((prev) => {
      const current = prev.items.get(id);
      if (!current || current.status !== 'success' || !current.metrics) {
        return prev;
      }
      const nextItems = new Map(prev.items);
      nextItems.set(id, { ...current, included: !current.included });
      return { ...prev, items: nextItems };
    });
  };

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Бэктесты</h1>
        <p className="page__subtitle">
          Журнал завершённых бэктестов с ключевыми метриками, пагинацией и возможностью выбирать результаты для дальнейшей обработки.
        </p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение Veles Tools неактивно. Запустите интерфейс из меню расширения, чтобы загрузить список бэктестов.
        </div>
      )}

      <div className="panel">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th className="table__checkbox">
                  <input
                    type="checkbox"
                    className="checkbox"
                    ref={selectAllRef}
                    checked={allCurrentSelected}
                    aria-label="Выбрать все на странице"
                    onChange={(event) => toggleCurrentPageSelection(event.target.checked)}
                    disabled={items.length === 0}
                  />
                </th>
                <th>Название</th>
                <th>Период</th>
                <th>Средняя длит.</th>
                <th>Биржа</th>
                <th>Пара</th>
                <th>Прибыль</th>
                <th>Net / день</th>
                <th>Сделки</th>
                <th>Win rate</th>
                <th>MFE / MAE</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11}>
                    <div className="loader">Загружаем данные…</div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">Нет данных для отображения.</div>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item) => {
                  const isChecked = selection.has(item.id);
                  return (
                    <tr key={item.id}>
                      <td className="table__checkbox">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelection(item)}
                          aria-label={`Выбрать бэктест ${item.name}`}
                        />
                      </td>
                      <td>
                        <div>{item.name}</div>
                        <div className="panel__description">
                          ID:{' '}
                          <a
                            href={`https://veles.finance/cabinet/backtests/${item.id}`}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {item.id}
                          </a>
                        </div>
                      </td>
                      <td>
                        <div>{new Date(item.from).toLocaleDateString()}</div>
                        <div className="panel__description">до {new Date(item.to).toLocaleDateString()}</div>
                      </td>
                      <td>{durationFormatter(item.avgDuration)}</td>
                      <td>{item.exchange}</td>
                      <td>
                        <div>{item.symbol}</div>
                        <div className="panel__description">{item.algorithm}</div>
                      </td>
                      <td>
                        <div>{formatAmount(item.profitQuote, item.quote)}</div>
                        <div className="panel__description">Base: {formatAmount(item.profitBase, item.base)}</div>
                      </td>
                      <td>
                        <div>{formatAmount(item.netQuote, item.quote)}</div>
                        <div className="panel__description">в день: {formatAmount(item.netQuotePerDay, item.quote)}</div>
                      </td>
                      <td>
                        <div>Всего: {item.totalDeals ?? '—'}</div>
                        <div className="panel__description">P/L/B: {item.profits ?? 0}/{item.losses ?? 0}/{item.breakevens ?? 0}</div>
                      </td>
                      <td>
                        <div>{formatPercent(item.winRateProfits)}</div>
                        <div className="panel__description">Loss: {formatPercent(item.winRateLosses)}</div>
                      </td>
                      <td>
                        <div>MFE: {formatPercent(item.mfePercent)}</div>
                        <div className="panel__description">MAE: {formatPercent(item.maePercent)}</div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <div className="pagination__info">Страница {page + 1} из {Math.max(totalPages, 1)}</div>
          <div className="pagination__controls">
            <div className="pagination__page-size">
              <label className="pagination__page-size-label" htmlFor="backtests-page-size">
                На странице:
              </label>
              <select id="backtests-page-size" className="select" value={pageSize} onChange={handlePageSizeChange}>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="button button--ghost" onClick={() => handlePageChange('prev')} disabled={page === 0 || loading}>
              Назад
            </button>
            <button
              type="button"
              className="button"
              onClick={() => handlePageChange('next')}
              disabled={loading || totalPages === 0 || page + 1 >= totalPages}
            >
              Далее
            </button>
          </div>
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
            {Array.from(selection.values()).map((item) => (
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
                <span style={{ marginLeft: 8, color: '#94a3b8' }}>{formatAmount(item.profitQuote, item.quote)}</span>
                {item.netQuote !== null && (
                  <span style={{ marginLeft: 8, color: '#94a3b8' }}>Net: {formatAmount(item.netQuote, item.quote)}</span>
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
              Соберите расширенную статистику выбранных бэктестов для анализа агрегированных метрик и одновременных позиций.
            </p>
          </div>
          <div className="panel__actions">
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
              disabled={!extensionReady || aggregationState.running || selection.size === 0}
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
                <li key={item.id}>ID {item.id}: {item.error}</li>
              ))}
            </ul>
          </div>
        )}

        {aggregationSummary ? (
          <Tabs
            className="aggregation-tabs"
            activeTabId={activeAggregationTab}
            onTabChange={setActiveAggregationTab}
            items={[
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
                      <div className="aggregation-metric__value">{formatAggregationInteger(aggregationSummary.totalSelected)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Суммарный P&amp;L
                        <InfoTooltip text="Совокупный результат всех включённых бэктестов в выбранной валюте." />
                      </div>
                      <div className={resolveTrendClass(aggregationSummary.totalPnl)}>{formatSignedAmount(aggregationSummary.totalPnl)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Avg P&amp;L / сделка
                        <InfoTooltip text="Средний результат одной сделки по всем включённым бэктестам." />
                      </div>
                      <div className={resolveTrendClass(aggregationSummary.avgPnlPerDeal)}>{formatSignedAmount(aggregationSummary.avgPnlPerDeal)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Avg P&amp;L / бэктест
                        <InfoTooltip text="Средний итог на один бэктест в агрегированной выборке." />
                      </div>
                      <div className={resolveTrendClass(aggregationSummary.avgPnlPerBacktest)}>{formatSignedAmount(aggregationSummary.avgPnlPerBacktest)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Средняя эффективность (Net/день)
                        <InfoTooltip text="Средний дневной результат по всем бэктестам, включённым в агрегированную статистику." />
                      </div>
                      <div className={resolveTrendClass(aggregationSummary.avgNetPerDay)}>{formatSignedAmount(aggregationSummary.avgNetPerDay)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Сделки (P/L/Σ)
                        <InfoTooltip text="Количество сделок и распределение по прибыльным, убыточным и нейтральным операциям." />
                      </div>
                      <div className="aggregation-metric__value aggregation-metric__value--muted">
                        {formatAggregationInteger(aggregationSummary.totalDeals)}
                        <span className="aggregation-metric__sub">
                          {' '}P:{formatAggregationInteger(aggregationSummary.totalProfits)} / L:{formatAggregationInteger(aggregationSummary.totalLosses)}
                        </span>
                      </div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Средняя длительность сделки (дни)
                        <InfoTooltip text="Средняя продолжительность сделок в днях среди включённых бэктестов." />
                      </div>
                      <div className="aggregation-metric__value">{formatAggregationValue(aggregationSummary.avgTradeDurationDays)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Средняя макс. просадка
                        <InfoTooltip text="Средняя максимальная просадка по каждому бэктесту; отрицательные значения указывают глубину падения." />
                      </div>
                      <div className={resolveTrendClass(-Math.abs(aggregationSummary.avgMaxDrawdown))}>{formatAggregationValue(aggregationSummary.avgMaxDrawdown)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Макс. суммарная просадка
                        <InfoTooltip text="Максимальное падение совокупного портфеля, составленного из всех включённых бэктестов. Это максимальный зафиксированный убыток от вашего портфеля в какой то момент бектеста. Например при срабатывании нескольких стопов подряд." />
                      </div>
                      <div className={resolveTrendClass(-Math.abs(aggregationSummary.aggregateDrawdown))}>{formatAggregationValue(aggregationSummary.aggregateDrawdown)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Макс. суммарное МПУ
                        <InfoTooltip text="Максимальная одновременная просадка по всем бэктестам, учитывая пересечения сделок. Такое значение нереализованного P&L вы бы увидели в самый худший день за период бектестов" />
                      </div>
                      <div className={resolveTrendClass(-Math.abs(aggregationSummary.aggregateMPU))}>{formatAggregationValue(aggregationSummary.aggregateMPU)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Макс. одновременно открытых
                        <InfoTooltip text="Пиковое количество одновременных позиций в любой день по всем бэктестам." />
                      </div>
                      <div className="aggregation-metric__value">{formatAggregationInteger(aggregationSummary.maxConcurrent)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Среднее одновременно открытых
                        <InfoTooltip text="Среднее число одновременных позиций за весь период наблюдений." />
                      </div>
                      <div className="aggregation-metric__value">{formatAggregationValue(aggregationSummary.avgConcurrent)}</div>
                    </div>
                    <div className="aggregation-metric">
                      <div className="aggregation-metric__label">
                        Дни без торговли
                        <InfoTooltip text="Количество дней без сделок в совокупном календаре выбранных бэктестов." />
                      </div>
                      <div className="aggregation-metric__value">{formatAggregationValue(aggregationSummary.noTradeDays)}</div>
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
                        <div className={portfolioFinalValue !== null ? resolveTrendClass(portfolioFinalValue) : 'aggregation-metric__value aggregation-metric__value--muted'}>
                          {portfolioFinalValue !== null ? formatSignedAmount(portfolioFinalValue) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="aggregation-equity__chart">
                      {portfolioEquitySeries && portfolioEquitySeries.points.length > 0 ? (
                        <PortfolioEquityChart
                          series={portfolioEquitySeries}
                          className="aggregation-equity__canvas"
                        />
                      ) : (
                        <div className="aggregation-equity__empty">Нет данных для построения графика.</div>
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
                        <div className="aggregation-metric__value">{formatAggregationValue(dailyConcurrencyStats?.meanMax ?? 0)}</div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          P75
                          <InfoTooltip text="75-й перцентиль дневных максимумов активных позиций." />
                        </div>
                        <div className="aggregation-metric__value">{formatAggregationValue(dailyConcurrencyStats?.p75 ?? 0)}</div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          P90
                          <InfoTooltip text="90-й перцентиль дневных максимумов активных позиций." />
                        </div>
                        <div className="aggregation-metric__value">{formatAggregationValue(dailyConcurrencyStats?.p90 ?? 0)}</div>
                      </div>
                      <div className="aggregation-metric">
                        <div className="aggregation-metric__label">
                          P95
                          <InfoTooltip text="95-й перцентиль дневных максимумов активных позиций." />
                        </div>
                        <div className="aggregation-metric__value">{formatAggregationValue(dailyConcurrencyStats?.p95 ?? 0)}</div>
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
            ] satisfies TabItem[]}
          />
        ) : (
          <div className="empty-state">
            {selection.size === 0
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
            <table className="table aggregation-table">
              <thead>
                <tr>
                  <th className="aggregation-table__toggle">В статистике</th>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Пара</th>
                  <th>P&amp;L</th>
                  <th>Net / день</th>
                  <th>Сделки</th>
                  <th>Avg длит. (д)</th>
                  <th>Дни без торговли</th>
                  <th>Макс. просадка</th>
                  <th>Макс. МПУ</th>
                  <th>Макс. МПП</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {aggregationItems.map((item) => {
                  const metrics = item.metrics;
                  const summary = selection.get(item.id);
                  const canToggle = item.status === 'success' && Boolean(metrics);
                  const isIncluded = canToggle && item.included;
                  return (
                    <tr key={item.id}>
                      <td className="aggregation-table__toggle">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={isIncluded}
                          disabled={!canToggle}
                          onChange={() => toggleAggregationInclude(item.id)}
                          aria-label={`Включить статистику по бэктесту ${item.id}`}
                        />
                      </td>
                      <td>
                        <a
                          href={`https://veles.finance/cabinet/backtests/${item.id}`}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {item.id}
                        </a>
                      </td>
                      <td>{metrics?.name ?? summary?.name ?? '—'}</td>
                      <td>{metrics?.symbol ?? summary?.symbol ?? '—'}</td>
                      <td>{metrics ? formatSignedAmount(metrics.pnl) : '—'}</td>
                      <td>{metrics ? formatSignedAmount(metrics.avgNetPerDay) : '—'}</td>
                      <td>{metrics ? formatAggregationInteger(metrics.totalDeals) : '—'}</td>
                      <td>{metrics ? `${formatAggregationValue(metrics.avgTradeDurationDays)} д` : '—'}</td>
                      <td>{metrics ? `${formatAggregationValue(metrics.downtimeDays)} д` : '—'}</td>
                      <td>{metrics ? formatAggregationValue(metrics.maxDrawdown) : '—'}</td>
                      <td>{metrics ? formatAggregationValue(metrics.maxMPU) : '—'}</td>
                      <td>{metrics ? formatAggregationValue(metrics.maxMPP) : '—'}</td>
                      <td>
                        <span className={resolveStatusTone(item.status)}>{resolveStatusLabel(item)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default BacktestsPage;
