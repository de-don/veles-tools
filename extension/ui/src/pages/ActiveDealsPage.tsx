import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { fetchAllActiveDeals, ACTIVE_DEALS_DEFAULT_SIZE } from '../api/activeDeals';
import { aggregateDeals, type ActiveDealsAggregation } from '../lib/activeDeals';
import type { ActiveDealMetrics } from '../lib/activeDeals';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import type { DataZoomRange } from '../lib/chartOptions';
import {
  ACTIVE_DEALS_ZOOM_PRESET_OPTIONS,
  areZoomRangesEqual,
  calculateZoomRangeForPreset,
  type ActiveDealsZoomPreset,
  type ActiveDealsZoomPresetKey,
} from '../lib/activeDealsZoom';
import type { ActiveDeal } from '../types/activeDeals';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import {
  ACTIVE_DEALS_REFRESH_INTERVALS,
  DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL,
  isActiveDealsRefreshInterval,
  type ActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';
import {
  clearActiveDealsSnapshot,
  readActiveDealsSnapshot,
  writeActiveDealsSnapshot,
} from '../storage/activeDealsStore';
import {
  readActiveDealsPreferences,
  writeActiveDealsPreferences,
} from '../storage/activeDealsPreferencesStore';
const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 0,
});

const priceFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 6,
  minimumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const formatSignedCurrency = (value: number): string => {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) {
    return '0.00';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${currencyFormatter.format(value)}`;
};

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return currencyFormatter.format(value);
};

const formatQuantity = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return quantityFormatter.format(value);
};

const formatPrice = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return priceFormatter.format(value);
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${percentFormatter.format(value)}%`;
};

const createEmptySeries = (): PortfolioEquitySeries => ({ points: [], minValue: 0, maxValue: 0 });

const buildSeriesWithPoint = (
  current: PortfolioEquitySeries | null,
  value: number,
  timestamp: number,
): PortfolioEquitySeries => {
  const base = current ?? createEmptySeries();
  const nextPoints = [...base.points, { time: timestamp, value }];
  if (nextPoints.length === 0) {
    return createEmptySeries();
  }
  const values = nextPoints.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  return { points: nextPoints, minValue, maxValue };
};

interface ActiveDealsPageProps {
  extensionReady: boolean;
}

interface DealsState {
  aggregation: ActiveDealsAggregation | null;
  positions: ActiveDealMetrics[];
  rawDeals: ActiveDeal[];
  totalDeals: number;
  lastUpdated: number | null;
}

const ActiveDealsPage = ({ extensionReady }: ActiveDealsPageProps) => {
  const [refreshInterval, setRefreshInterval] = useState<ActiveDealsRefreshInterval>(() => {
    const preferences = readActiveDealsPreferences();
    return preferences?.refreshInterval ?? DEFAULT_ACTIVE_DEALS_REFRESH_INTERVAL;
  });
  const [dealsState, setDealsState] = useState<DealsState>({
    aggregation: null,
    positions: [],
    rawDeals: [],
    totalDeals: 0,
    lastUpdated: null,
  });
  const [pnlSeries, setPnlSeries] = useState<PortfolioEquitySeries>(() => createEmptySeries());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<DataZoomRange | undefined>(undefined);
  const [zoomPreset, setZoomPreset] = useState<ActiveDealsZoomPreset>('all');

  const timerRef = useRef<number | null>(null);
  const initialLoadRef = useRef(false);

  const seriesRef = useRef<PortfolioEquitySeries>(pnlSeries);

  useEffect(() => {
    seriesRef.current = pnlSeries;
  }, [pnlSeries]);

  const appendSeriesPoint = useCallback(
    (value: number, timestamp: number): PortfolioEquitySeries => {
      const nextSeries = buildSeriesWithPoint(seriesRef.current, value, timestamp);
      seriesRef.current = nextSeries;
      setPnlSeries(nextSeries);
      return nextSeries;
    },
    [],
  );
  useEffect(() => {
    writeActiveDealsPreferences({ refreshInterval });
  }, [refreshInterval]);

  const resetPolling = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleDealsResponse = useCallback(
    (deals: ActiveDeal[], aggregation: ActiveDealsAggregation, timestamp: number) => {
      appendSeriesPoint(aggregation.totalPnl, timestamp);
      setDealsState({
        aggregation,
        positions: aggregation.positions,
        rawDeals: deals,
        totalDeals: deals.length,
        lastUpdated: timestamp,
      });
    },
    [appendSeriesPoint],
  );

  const fetchDeals = useCallback(async () => {
    if (!extensionReady) {
      return;
    }

    setError(null);
    if (!initialLoadRef.current) {
      setLoading(true);
    }

    try {
      const deals = await fetchAllActiveDeals({
        size: ACTIVE_DEALS_DEFAULT_SIZE,
      });
      const aggregation = aggregateDeals(deals);
      const timestamp = Date.now();
      handleDealsResponse(deals, aggregation, timestamp);
      initialLoadRef.current = true;
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [extensionReady, handleDealsResponse]);

  useEffect(() => {
    if (!extensionReady) {
      resetPolling();
      const emptySeries = createEmptySeries();
      seriesRef.current = emptySeries;
      setDealsState({ aggregation: null, positions: [], rawDeals: [], totalDeals: 0, lastUpdated: null });
      setPnlSeries(emptySeries);
      setZoomRange(undefined);
      setZoomPreset('all');
      initialLoadRef.current = false;
      setLoading(false);
      setError(null);
      return;
    }

    fetchDeals().catch(() => {
      // error state handled inside fetchDeals
    });

    resetPolling();
    timerRef.current = window.setInterval(() => {
      fetchDeals().catch(() => {
        // errors handled
      });
    }, refreshInterval * 1000);

    return () => {
      resetPolling();
    };
  }, [extensionReady, fetchDeals, refreshInterval, resetPolling]);

  useEffect(() => {
    return () => {
      resetPolling();
    };
  }, [resetPolling]);

  const onRefreshIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = Number(event.target.value);
    if (isActiveDealsRefreshInterval(nextValue)) {
      setRefreshInterval(nextValue);
    }
  };

  const handleZoomChange = useCallback((range: DataZoomRange) => {
    setZoomRange((prev) => {
      const next: DataZoomRange = {
        start: typeof range.start === 'number' ? range.start : prev?.start,
        end: typeof range.end === 'number' ? range.end : prev?.end,
      };
      if (areZoomRangesEqual(prev, next)) {
        return prev;
      }
      setZoomPreset((previousPreset) => (previousPreset === 'custom' ? previousPreset : 'custom'));
      return next;
    });
  }, [setZoomPreset, areZoomRangesEqual]);

  const applyZoomPreset = useCallback((presetKey: ActiveDealsZoomPresetKey) => {
    const nextRange = calculateZoomRangeForPreset(seriesRef.current, presetKey);
    setZoomRange((prev) => {
      if (areZoomRangesEqual(prev, nextRange)) {
        return prev;
      }
      return nextRange;
    });
    setZoomPreset(presetKey);
  }, [setZoomPreset, areZoomRangesEqual, calculateZoomRangeForPreset]);

  const handleResetHistory = useCallback(() => {
    clearActiveDealsSnapshot();
    const emptySeries = createEmptySeries();
    seriesRef.current = emptySeries;
    setPnlSeries(emptySeries);
    setDealsState({ aggregation: null, positions: [], rawDeals: [], totalDeals: 0, lastUpdated: null });
    setZoomRange(undefined);
    setZoomPreset('all');
    initialLoadRef.current = false;
    setError(null);
  }, []);

  useEffect(() => {
    if (zoomPreset === 'custom') {
      return;
    }
    const nextRange = calculateZoomRangeForPreset(seriesRef.current, zoomPreset);
    setZoomRange((prev) => {
      if (areZoomRangesEqual(prev, nextRange)) {
        return prev;
      }
      return nextRange;
    });
  }, [pnlSeries, zoomPreset, areZoomRangesEqual, calculateZoomRangeForPreset]);

  useEffect(() => {
    const snapshot = readActiveDealsSnapshot();
    if (!snapshot) {
      return;
    }

    const aggregation = aggregateDeals(snapshot.deals);
    seriesRef.current = snapshot.series;
    setPnlSeries(snapshot.series);
    setDealsState({
      aggregation,
      positions: aggregation.positions,
      rawDeals: snapshot.deals,
      totalDeals: snapshot.deals.length,
      lastUpdated: snapshot.lastUpdated,
    });
    setZoomRange(snapshot.zoomRange ?? undefined);
    setZoomPreset(snapshot.zoomPreset ?? 'all');
    initialLoadRef.current = snapshot.deals.length > 0;
  }, []);

  useEffect(() => {
    if (dealsState.rawDeals.length === 0) {
      return;
    }
    writeActiveDealsSnapshot({
      deals: dealsState.rawDeals,
      series: seriesRef.current,
      zoomRange,
      zoomPreset,
      lastUpdated: dealsState.lastUpdated,
      storedAt: Date.now(),
    });
  }, [dealsState.rawDeals, dealsState.lastUpdated, zoomRange, zoomPreset]);

  const summary = useMemo(() => {
    const aggregation = dealsState.aggregation;
    if (!aggregation) {
      return {
        exposure: 0,
        pnl: 0,
        profitable: 0,
        losing: 0,
        flat: 0,
      };
    }
    return {
      exposure: aggregation.totalExposure,
      pnl: aggregation.totalPnl,
      profitable: aggregation.profitableCount,
      losing: aggregation.losingCount,
      flat: aggregation.flatCount,
    };
  }, [dealsState.aggregation]);

  const lastUpdatedLabel = useMemo(() => {
    if (!dealsState.lastUpdated) {
      return '—';
    }
    return new Date(dealsState.lastUpdated).toLocaleTimeString();
  }, [dealsState.lastUpdated]);

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Активные сделки</h1>
        <p className="page__subtitle">
          Сводка открытых позиций с автоматическим обновлением и агрегированным P&amp;L.
        </p>
      </header>

      {!extensionReady && (
        <div className="banner banner--warning">
          Расширение Veles Tools неактивно. Откройте интерфейс из расширения, чтобы получить доступ к активным сделкам.
        </div>
      )}

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Мониторинг сделок</h2>
            <p className="panel__description">
              Выбор интервала обновления данных и текущие агрегированные показатели портфеля.
            </p>
          </div>
          <div className="panel__actions">
            <select
              className="select"
              value={refreshInterval}
              onChange={onRefreshIntervalChange}
              aria-label="Интервал обновления"
            >
              {ACTIVE_DEALS_REFRESH_INTERVALS.map((interval) => (
                <option key={interval} value={interval}>
                  {interval} сек
                </option>
              ))}
            </select>
            <button type="button" className="button button--ghost" onClick={handleResetHistory}>
              Сбросить данные
            </button>
          </div>
        </div>

        <div className="aggregation-summary">
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">Суммарный P&amp;L</div>
            <div
              className={`aggregation-metric__value ${
                summary.pnl >= 0 ? 'aggregation-metric__value--positive' : 'aggregation-metric__value--negative'
              }`}
            >
              {formatSignedCurrency(summary.pnl)} USDT
            </div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              Экспозиция
              <InfoTooltip text="Совокупный объём позиций: сумма |количество| × средняя цена входа по каждой сделке." />
            </div>
            <div className="aggregation-metric__value">{formatCurrency(summary.exposure)} USDT</div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              Всего сделок
              <InfoTooltip text="Количество активных сделок, полученных из эндпоинта /api/cycles/active." />
            </div>
            <div className="aggregation-metric__value">{dealsState.totalDeals}</div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              В плюсе
              <InfoTooltip text="Число сделок с положительным текущим P&L." />
            </div>
            <div className="aggregation-metric__value">{summary.profitable}</div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              В минусе
              <InfoTooltip text="Число сделок с отрицательным текущим P&L." />
            </div>
            <div className="aggregation-metric__value">{summary.losing}</div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              Без изменений
              <InfoTooltip text="Сделки, у которых рассчитанный P&L равен нулю." />
            </div>
            <div className="aggregation-metric__value">{summary.flat}</div>
          </div>
          <div className="aggregation-metric">
            <div className="aggregation-metric__label">
              Последнее обновление
              <InfoTooltip text="Местное время последнего успешного запроса к API." />
            </div>
            <div className="aggregation-metric__value aggregation-metric__value--muted">{lastUpdatedLabel}</div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="panel__header">
          <div>
            <h2 className="panel__title">Динамика агрегированного P&amp;L</h2>
            <p className="panel__description">
              На графике отображается история суммарного результата портфеля с выбранным интервалом обновления.
              История накапливается только пока эта страница открыта.
            </p>
          </div>
        </div>
        <div className="chart-zoom-presets" role="group" aria-label="Интервалы отображения графика">
          {ACTIVE_DEALS_ZOOM_PRESET_OPTIONS.map((preset) => {
            const isActive = zoomPreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                className={`chart-zoom-presets__button${isActive ? ' chart-zoom-presets__button--active' : ''}`}
                onClick={() => applyZoomPreset(preset.key)}
                aria-pressed={isActive}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="aggregation-equity__chart">
          {pnlSeries.points.length === 0 ? (
            <div className="empty-state">Нет данных для отображения. Подождите первое обновление.</div>
          ) : (
            <PortfolioEquityChart
              className="aggregation-equity__canvas"
              series={pnlSeries}
              dataZoomRange={zoomRange}
              onDataZoom={handleZoomChange}
            />
          )}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Список сделок</h2>
        {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID сделки</th>
                <th>Бот</th>
                <th>Пара</th>
                <th>Кол-во</th>
                <th>Вход</th>
                <th>Текущая</th>
                <th>P&amp;L, USDT</th>
                <th>P&amp;L, %</th>
                <th>Старт</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9}>
                    <div className="loader">Загружаем данные…</div>
                  </td>
                </tr>
              )}
              {!loading && dealsState.positions.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">Активных сделок нет.</div>
                  </td>
                </tr>
              )}
              {!loading &&
                dealsState.positions.map((position) => {
                  const { deal } = position;
                  const amountLabel = position.absQuantity > 0 ? formatQuantity(position.absQuantity) : '—';
                  const entryLabel = position.averageEntryPrice > 0 ? formatPrice(position.averageEntryPrice) : '—';
                  const markLabel = position.markPrice > 0 ? formatPrice(position.markPrice) : '—';
                  return (
                    <tr key={deal.id}>
                      <td>{deal.id}</td>
                      <td>
                        <div>{deal.botName}</div>
                        <div className="panel__description">Bot ID: {deal.botId}</div>
                      </td>
                      <td>
                        <div>{deal.symbol}</div>
                        <div className="panel__description">{deal.pair.symbol}</div>
                      </td>
                      <td>{amountLabel}</td>
                      <td>{entryLabel}</td>
                      <td>{markLabel}</td>
                      <td style={{ color: position.pnl >= 0 ? '#047857' : position.pnl < 0 ? '#b91c1c' : '#334155' }}>
                        {formatSignedCurrency(position.pnl)}
                      </td>
                      <td style={{ color: position.pnlPercent >= 0 ? '#047857' : position.pnlPercent < 0 ? '#b91c1c' : '#334155' }}>
                        {formatPercent(position.pnlPercent)}
                      </td>
                      <td>{new Date(deal.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ActiveDealsPage;
