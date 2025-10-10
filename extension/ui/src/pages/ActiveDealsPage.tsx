import { useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import type { DataZoomRange } from '../lib/chartOptions';
import {
  ACTIVE_DEALS_ZOOM_PRESET_OPTIONS,
  areZoomRangesEqual,
  calculateZoomRangeForPreset,
  type ActiveDealsZoomPresetKey,
} from '../lib/activeDealsZoom';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import {
  ACTIVE_DEALS_REFRESH_INTERVALS,
  isActiveDealsRefreshInterval,
} from '../lib/activeDealsPolling';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import { useActiveDeals } from '../context/ActiveDealsContext';
import type { ActiveDealMetrics } from '../lib/activeDeals';
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

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return '—';
  }
  return new Date(timestamp).toLocaleString('ru-RU');
};

interface ActiveDealsPageProps {
  extensionReady: boolean;
}

const ActiveDealsPage = ({ extensionReady }: ActiveDealsPageProps) => {
  const {
    dealsState,
    pnlSeries,
    loading,
    error,
    refreshInterval,
    setRefreshInterval,
    resetHistory,
    zoomRange,
    setZoomRange,
    zoomPreset,
    setZoomPreset,
  } = useActiveDeals();

  const seriesRef = useRef<PortfolioEquitySeries>(pnlSeries);

  useEffect(() => {
    seriesRef.current = pnlSeries;
  }, [pnlSeries]);

  const onRefreshIntervalChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = Number(event.target.value);
    if (isActiveDealsRefreshInterval(nextValue)) {
      setRefreshInterval(nextValue);
    }
  };

  const handleZoomChange = useCallback(
    (range: DataZoomRange) => {
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
    },
    [setZoomPreset, setZoomRange, areZoomRangesEqual],
  );

  const applyZoomPreset = useCallback(
    (presetKey: ActiveDealsZoomPresetKey) => {
      const nextRange = calculateZoomRangeForPreset(seriesRef.current, presetKey);
      setZoomRange((prev) => {
        if (areZoomRangesEqual(prev, nextRange)) {
          return prev;
        }
        return nextRange;
      });
      setZoomPreset(presetKey);
    },
    [setZoomRange, setZoomPreset, calculateZoomRangeForPreset, areZoomRangesEqual],
  );

  const handleResetHistory = useCallback(() => {
    resetHistory();
  }, [resetHistory]);

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
  }, [pnlSeries, zoomPreset, setZoomRange, calculateZoomRangeForPreset, areZoomRangesEqual]);

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

  const positions = dealsState.positions;

  const dealsColumns: ColumnsType<ActiveDealMetrics> = useMemo(
    () => [
      {
        title: 'ID сделки',
        dataIndex: ['deal', 'id'],
        key: 'id',
        width: 110,
        sorter: (a, b) => a.deal.id - b.deal.id,
        render: (_value, record) => record.deal.id,
      },
      {
        title: 'Бот',
        dataIndex: ['deal', 'botName'],
        key: 'botName',
        ellipsis: true,
        render: (_value, record) => record.deal.botName ?? '—',
      },
      {
        title: 'Пара',
        dataIndex: ['deal', 'symbol'],
        key: 'symbol',
        render: (_value, record) => `${record.deal.symbol} · ${record.deal.algorithm}`,
      },
      {
        title: 'Кол-во',
        dataIndex: 'absQuantity',
        key: 'quantity',
        align: 'right',
        render: (_value, record) => formatQuantity(record.absQuantity),
      },
      {
        title: 'Вход',
        dataIndex: 'averageEntryPrice',
        key: 'entryPrice',
        align: 'right',
        render: (_value, record) => formatPrice(record.averageEntryPrice),
      },
      {
        title: 'Текущая',
        dataIndex: 'markPrice',
        key: 'markPrice',
        align: 'right',
        render: (_value, record) => formatPrice(record.markPrice),
      },
      {
        title: 'P&L, USDT',
        dataIndex: 'pnl',
        key: 'pnl',
        align: 'right',
        sorter: (a, b) => a.pnl - b.pnl,
        defaultSortOrder: 'descend',
        render: (_value, record) => (
          <span style={{ color: record.pnl > 0 ? '#047857' : record.pnl < 0 ? '#b91c1c' : '#334155' }}>
            {formatSignedCurrency(record.pnl)}
          </span>
        ),
      },
      {
        title: 'P&L, %',
        dataIndex: 'pnlPercent',
        key: 'pnlPercent',
        align: 'right',
        sorter: (a, b) => a.pnlPercent - b.pnlPercent,
        render: (_value, record) => (
          <span style={{ color: record.pnlPercent > 0 ? '#047857' : record.pnlPercent < 0 ? '#b91c1c' : '#334155' }}>
            {formatPercent(record.pnlPercent)}
          </span>
        ),
      },
      {
        title: 'Старт',
        dataIndex: ['deal', 'createdAt'],
        key: 'createdAt',
        sorter: (a, b) => Date.parse(a.deal.createdAt) - Date.parse(b.deal.createdAt),
        render: (_value, record) => formatDateTime(record.deal.createdAt),
      },
    ],
    [],
  );

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
              Текущие агрегированные показатели портфеля.
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
              История накапливается только когда вкладка с расширением открыта.
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
          <button type="button" className="button button--ghost" onClick={handleResetHistory}>
            Сбросить данные
          </button>
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
          <Table<ActiveDealMetrics>
            columns={dealsColumns}
            dataSource={positions}
            rowKey={(record) => record.deal.id}
            pagination={false}
            loading={loading}
            locale={{ emptyText: 'Активных сделок нет.' }}
            scroll={{ x: true }}
          />
        </div>
      </div>
    </section>
  );
};

export default ActiveDealsPage;
