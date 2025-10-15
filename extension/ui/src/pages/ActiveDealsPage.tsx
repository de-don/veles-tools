import { message, Popconfirm, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeActiveDeal } from '../api/activeDeals';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import { TableColumnSettingsButton } from '../components/ui/TableColumnSettingsButton';
import { useActiveDeals } from '../context/ActiveDealsContext';
import type { ActiveDealMetrics } from '../lib/activeDeals';
import { ACTIVE_DEALS_REFRESH_INTERVALS, isActiveDealsRefreshInterval } from '../lib/activeDealsPolling';
import {
  ACTIVE_DEALS_ZOOM_PRESET_OPTIONS,
  type ActiveDealsZoomPresetKey,
  areZoomRangesEqual,
  calculateZoomRangeForPreset,
} from '../lib/activeDealsZoom';
import type { PortfolioEquitySeries } from '../lib/backtestAggregation';
import { buildBotDetailsUrl, buildDealStatisticsUrl } from '../lib/cabinetUrls';
import type { DataZoomRange } from '../lib/chartOptions';
import type { ActiveDeal } from '../types/activeDeals';
import { useTableColumnSettings } from '../lib/useTableColumnSettings';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const quantityFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 4,
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

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${percentFormatter.format(value)}%`;
};

const getDealBaseAsset = (deal: ActiveDeal): string => {
  if (deal.pair?.from) {
    return deal.pair.from;
  }
  if (deal.symbol) {
    const [base] = deal.symbol.split(/[/-]/);
    return base?.replace(/USD(T)?$/i, '') ?? deal.symbol;
  }
  return '—';
};

const MAX_PRICE_DECIMALS = 6;

const countFractionDigits = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = value.toFixed(MAX_PRICE_DECIMALS);
  const fraction = normalized.split('.')[1]?.replace(/0+$/, '');
  return Math.min(MAX_PRICE_DECIMALS, fraction?.length ?? 0);
};

const formatPriceWithDigits = (value: number, fractionDigits: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const digits = Math.max(0, Math.min(MAX_PRICE_DECIMALS, fractionDigits));
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const getDateParts = (value: string | null | undefined): { time: string; date: string } => {
  if (!value) {
    return { time: '—', date: '—' };
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return { time: '—', date: '—' };
  }
  const date = new Date(timestamp);
  const timeLabel = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateLabel = date.toLocaleDateString('ru-RU');
  return { time: timeLabel, date: dateLabel };
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
    fetchDeals,
    zoomRange,
    setZoomRange,
    zoomPreset,
    setZoomPreset,
  } = useActiveDeals();

  const [closingDealId, setClosingDealId] = useState<number | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();

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
    [setZoomPreset, setZoomRange],
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
    [setZoomRange, setZoomPreset],
  );

  const handleResetHistory = useCallback(() => {
    resetHistory();
  }, [resetHistory]);

  const handleCloseDeal = useCallback(
    async (deal: ActiveDeal) => {
      if (closingDealId !== null) {
        return;
      }
      setClosingDealId(deal.id);

      try {
        await closeActiveDeal(deal.id);
        messageApi.success(`Сделка ${deal.id} закрыта.`);
        await fetchDeals();
      } catch (closeError: unknown) {
        const rawMessage = closeError instanceof Error ? closeError.message : String(closeError);
        const trimmed = typeof rawMessage === 'string' ? rawMessage.trim() : '';
        messageApi.error(
          `Не удалось закрыть сделку ${deal.id}: ${trimmed.length > 0 ? trimmed : 'неизвестная ошибка'}`,
        );
      } finally {
        setClosingDealId((current) => (current === deal.id ? null : current));
      }
    },
    [closingDealId, fetchDeals, messageApi],
  );

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
  }, [zoomPreset, setZoomRange]);

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
        title: 'Бот',
        dataIndex: ['deal', 'botName'],
        key: 'bot',
        width: 260,
        fixed: 'left',
        render: (_value, record) => {
          const botName = record.deal.botName ?? '—';
          const baseAsset = getDealBaseAsset(record.deal);
          const botUrl = buildBotDetailsUrl(record.deal.botId);
          return (
            <div className="active-deals__bot-cell">
              <a className="active-deals__bot-link" href={botUrl} target="_blank" rel="noreferrer">
                {botName}
              </a>
              <div className="active-deals__bot-meta">
                <span>{baseAsset}</span>
                <span>·</span>
                <span>{record.deal.algorithm}</span>
              </div>
            </div>
          );
        },
      },
      {
        title: 'P&L, USDT',
        dataIndex: 'pnl',
        key: 'pnl',
        align: 'right',
        sorter: (a, b) => a.pnl - b.pnl,
        defaultSortOrder: 'descend',
        render: (_value, record) => (
          <span
            style={{
              color: record.pnl > 0 ? '#047857' : record.pnl < 0 ? '#b91c1c' : '#334155',
            }}
          >
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
          <span
            style={{
              color: record.pnlPercent > 0 ? '#047857' : record.pnlPercent < 0 ? '#b91c1c' : '#334155',
            }}
          >
            {formatPercent(record.pnlPercent)}
          </span>
        ),
      },
      {
        title: 'Вход / Текущая',
        dataIndex: 'averageEntryPrice',
        key: 'prices',
        align: 'right',
        width: 210,
        render: (_value, record) => {
          const entryDigits = countFractionDigits(record.averageEntryPrice);
          const markDigits = countFractionDigits(record.markPrice);
          const alignedDigits = Math.max(entryDigits, markDigits);
          return (
            <div className="active-deals__price-cell">
              <div className="active-deals__price-row">
                <span className="active-deals__price-label">Вход</span>
                <span className="active-deals__price-value">
                  {formatPriceWithDigits(record.averageEntryPrice, alignedDigits)}
                </span>
              </div>
              <div className="active-deals__price-row">
                <span className="active-deals__price-label">Текущая</span>
                <span className="active-deals__price-value">
                  {formatPriceWithDigits(record.markPrice, alignedDigits)}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        title: 'Дата открытия',
        dataIndex: ['deal', 'createdAt'],
        key: 'createdAt',
        sorter: (a, b) => Date.parse(a.deal.createdAt) - Date.parse(b.deal.createdAt),
        render: (_value, record) => {
          const parts = getDateParts(record.deal.createdAt);
          return (
            <div className="active-deals__date-cell">
              <span className="active-deals__date-time">{parts.time}</span>
              <span className="active-deals__date-day">{parts.date}</span>
            </div>
          );
        },
      },
      {
        title: 'Кол-во',
        dataIndex: 'absQuantity',
        key: 'quantity',
        align: 'right',
        width: 120,
        render: (_value, record) => formatQuantity(record.absQuantity),
      },
      {
        title: 'Ордеры',
        key: 'ordersProgress',
        align: 'right',
        width: 120,
        render: (_value, record) => `${record.executedOrdersCount}/${record.totalOrdersCount}`,
      },
      {
        title: 'ID сделки',
        dataIndex: ['deal', 'id'],
        key: 'id',
        width: 140,
        align: 'right',
        sorter: (a, b) => a.deal.id - b.deal.id,
        render: (_value, record) => {
          const target = buildDealStatisticsUrl(record.deal.id);
          return (
            <a className="active-deals__id-link" href={target} target="_blank" rel="noreferrer">
              {record.deal.id}
            </a>
          );
        },
      },
      {
        title: 'Действия',
        key: 'actions',
        width: 160,
        fixed: 'right',
        render: (_value, record) => {
          const isClosing = closingDealId === record.deal.id;
          const actionsDisabled = closingDealId !== null;
          const buttonToneClass =
            record.pnl > 0
              ? 'active-deals__close-button--positive'
              : record.pnl < 0
                ? 'active-deals__close-button--negative'
                : 'active-deals__close-button--neutral';
          return (
            <Popconfirm
              title="Закрыть сделку?"
              description={`Сделка ${record.deal.id} будет закрыта.`}
              okText="Закрыть"
              cancelText="Отмена"
              placement="left"
              onConfirm={() => handleCloseDeal(record.deal)}
              disabled={actionsDisabled}
            >
              <button
                type="button"
                className={`button active-deals__close-button ${buttonToneClass}`}
                disabled={actionsDisabled}
              >
                {isClosing ? 'Закрытие...' : 'Закрыть'}
              </button>
            </Popconfirm>
          );
        },
      },
    ],
    [closingDealId, handleCloseDeal],
  );

  const {
    columns: visibleDealsColumns,
    settings: dealsColumnSettings,
    moveColumn: moveDealsColumn,
    setColumnVisibility: setDealColumnVisibility,
    reset: resetDealsColumns,
    hasCustomSettings: dealsHasCustomSettings,
  } = useTableColumnSettings<ActiveDealMetrics>({
    tableKey: 'active-deals-table',
    columns: dealsColumns,
  });

  return (
    <>
      {messageContextHolder}
      <section className="page">
        <header className="page__header">
          <h1 className="page__title">Активные сделки</h1>
          <p className="page__subtitle">
            Сводка открытых позиций с автоматическим обновлением и агрегированным P&amp;L.
          </p>
        </header>

        {!extensionReady && (
          <div className="banner banner--warning">
            Расширение Veles Tools неактивно. Откройте интерфейс из расширения, чтобы получить доступ к активным
            сделкам.
          </div>
        )}

        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Мониторинг сделок</h2>
              <p className="panel__description">Текущие агрегированные показатели портфеля.</p>
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
          <fieldset className="chart-zoom-presets" aria-label="Интервалы отображения графика">
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
          </fieldset>
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
          <div className="panel__header">
            <div>
              <h2 className="panel__title">Список сделок</h2>
            </div>
            <div className="panel__actions">
              <TableColumnSettingsButton
                settings={dealsColumnSettings}
                moveColumn={moveDealsColumn}
                setColumnVisibility={setDealColumnVisibility}
                reset={resetDealsColumns}
                hasCustomSettings={dealsHasCustomSettings}
              />
            </div>
          </div>
          {error && (
            <div className="form-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div className="table-container">
            <Table<ActiveDealMetrics>
              columns={visibleDealsColumns}
              dataSource={positions}
              rowKey={(record) => record.deal.id}
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Активных сделок нет.' }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </div>
      </section>
    </>
  );
};

export default ActiveDealsPage;
