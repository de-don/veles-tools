import { Button, Card, message, Popconfirm, Segmented, Select, Space, Switch, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closeActiveDeal } from '../api/activeDeals';
import { PortfolioEquityChart } from '../components/charts/PortfolioEquityChart';
import { Sparkline, type SparklineMarker, type SparklinePoint } from '../components/charts/Sparkline';
import { InfoTooltip } from '../components/ui/InfoTooltip';
import PageHeader from '../components/ui/PageHeader';
import { StatisticCard } from '../components/ui/StatisticCard';
import { TableColumnSettingsButton } from '../components/ui/TableColumnSettingsButton';
import { useActiveDeals } from '../context/ActiveDealsContext';
import { type ActiveDealMetrics, buildExecutedOrdersIndex, getDealBaseAsset } from '../lib/activeDeals';
import type { DealHistoryPoint } from '../lib/activeDealsHistory';
import { ACTIVE_DEALS_REFRESH_INTERVALS, isActiveDealsRefreshInterval } from '../lib/activeDealsPolling';
import {
  ACTIVE_DEALS_ZOOM_PRESET_OPTIONS,
  type ActiveDealsZoomPresetKey,
  areZoomRangesEqual,
  calculateZoomRangeForPreset,
} from '../lib/activeDealsZoom';
import { buildBotDetailsUrl, buildDealStatisticsUrl } from '../lib/cabinetUrls';
import type { DataZoomRange } from '../lib/chartOptions';
import type { ExecutedOrderPoint, PortfolioEquitySeries } from '../lib/deprecatedFile';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useTableColumnSettings } from '../lib/useTableColumnSettings';
import type { ActiveDeal } from '../types/activeDeals';

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

interface ZoomTimeWindow {
  start: number;
  end: number;
}

const clampZoomPercent = (value?: number): number | undefined => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 100) {
    return 100;
  }
  return value;
};

const calculateZoomTimeWindow = (series: PortfolioEquitySeries, range?: DataZoomRange): ZoomTimeWindow | null => {
  if (!series.points.length) {
    return null;
  }
  const firstPoint = series.points[0];
  const lastPoint = series.points[series.points.length - 1];
  if (!(firstPoint && lastPoint)) {
    return null;
  }
  let start = firstPoint.time;
  let end = lastPoint.time;

  const clampTimestamp = (value: number) => Math.min(Math.max(value, firstPoint.time), lastPoint.time);

  if (typeof range?.startValue === 'number') {
    start = clampTimestamp(range.startValue);
  } else {
    const startPercent = clampZoomPercent(range?.start);
    if (typeof startPercent === 'number') {
      const totalSpan = Math.max(1, lastPoint.time - firstPoint.time);
      start = firstPoint.time + (totalSpan * startPercent) / 100;
    }
  }

  if (typeof range?.endValue === 'number') {
    end = clampTimestamp(range.endValue);
  } else {
    const endPercent = clampZoomPercent(range?.end);
    if (typeof endPercent === 'number') {
      const totalSpan = Math.max(1, lastPoint.time - firstPoint.time);
      end = firstPoint.time + (totalSpan * endPercent) / 100;
    }
  }

  if (end <= start) {
    end = start + 1;
  }
  return { start, end } satisfies ZoomTimeWindow;
};

const filterHistoryByWindow = (
  history: readonly DealHistoryPoint[],
  window: ZoomTimeWindow | null,
): DealHistoryPoint[] => {
  if (!window) {
    return [...history];
  }
  // Find the first point inside or after the window
  const startIndex = history.findIndex((point) => point.time >= window.start);

  if (startIndex === -1) {
    // All points are before the window. Return the last one if exists (to draw a flat line from it)
    // or empty if history is empty.
    const last = history[history.length - 1];
    return last ? [last] : [];
  }

  // Include the point immediately before the window start, if it exists
  const effectiveStartIndex = Math.max(0, startIndex - 1);

  // Filter points up to window.end
  return history
    .slice(effectiveStartIndex)
    .filter((point) => point.time <= window.end || point === history[effectiveStartIndex]);
};

const ENTRY_MARKER_COLOR = '#10b981';
const DCA_MARKER_COLOR = '#ef4444';

const filterOrdersByWindow = (
  orders: readonly ExecutedOrderPoint[],
  window: ZoomTimeWindow | null,
): ExecutedOrderPoint[] => {
  if (!window) {
    return [...orders];
  }
  return orders.filter((order) => order.time >= window.start && order.time <= window.end);
};

const interpolateHistoryValue = (points: readonly SparklinePoint[], timestamp: number): number | null => {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return points[0].value;
  }
  const first = points[0];
  const last = points[points.length - 1];
  if (!(first && last)) {
    return null;
  }
  if (timestamp <= first.time) {
    return first.value;
  }
  if (timestamp >= last.time) {
    return last.value;
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!(previous && current)) {
      continue;
    }
    if (timestamp === current.time) {
      return current.value;
    }
    if (timestamp < current.time) {
      const ratio = (timestamp - previous.time) / (current.time - previous.time);
      return previous.value + (current.value - previous.value) * ratio;
    }
  }
  return last.value;
};

const buildSparklineMarkers = (
  orders: readonly ExecutedOrderPoint[],
  points: readonly SparklinePoint[],
  window: ZoomTimeWindow | null,
): SparklineMarker[] => {
  if (orders.length === 0 || points.length === 0) {
    return [];
  }

  const windowedOrders = filterOrdersByWindow(orders, window);
  if (windowedOrders.length === 0) {
    return [];
  }

  return windowedOrders
    .map((order) => {
      const value = interpolateHistoryValue(points, order.time);
      if (value === null) {
        return null;
      }
      const color = order.type === 'ENTRY' ? ENTRY_MARKER_COLOR : DCA_MARKER_COLOR;
      const marker: SparklineMarker = { time: order.time, value, color };
      return marker;
    })
    .filter((marker): marker is SparklineMarker => marker !== null);
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

const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getDealLifetimeMs = (deal: ActiveDeal, referenceTimestamp?: number): number | null => {
  const createdAtTimestamp = parseTimestamp(deal.createdAt);
  if (createdAtTimestamp === null) {
    return null;
  }
  const now = typeof referenceTimestamp === 'number' ? referenceTimestamp : Date.now();
  if (!Number.isFinite(now)) {
    return null;
  }
  return Math.max(0, now - createdAtTimestamp);
};

const formatDealLifetime = (deal: ActiveDeal, referenceTimestamp?: number): string => {
  const lifetimeMs = getDealLifetimeMs(deal, referenceTimestamp);
  if (lifetimeMs === null) {
    return '—';
  }
  if (lifetimeMs < MS_IN_MINUTE) {
    const seconds = Math.max(1, Math.floor(lifetimeMs / MS_IN_SECOND));
    return `${seconds} с`;
  }
  const days = Math.floor(lifetimeMs / MS_IN_DAY);
  const hours = Math.floor((lifetimeMs % MS_IN_DAY) / MS_IN_HOUR);
  const minutes = Math.floor((lifetimeMs % MS_IN_HOUR) / MS_IN_MINUTE);
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}д`);
  }
  if (hours > 0) {
    parts.push(`${hours}ч`);
  }
  if (parts.length < 2 && minutes > 0) {
    parts.push(`${minutes} мин`);
  }
  if (parts.length === 0) {
    parts.push('1 мин');
  }
  return parts.slice(0, 2).join(' ');
};

interface ActiveDealsPageProps {
  extensionReady: boolean;
}

const ActiveDealsPage = ({ extensionReady }: ActiveDealsPageProps) => {
  const {
    dealsState,
    pnlSeries,
    groupedPnlSeries,
    groupByApiKey,
    setGroupByApiKey,
    apiKeysById,
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
    positionHistory,
  } = useActiveDeals();

  const zoomTimeWindow = useMemo(() => calculateZoomTimeWindow(pnlSeries, zoomRange), [pnlSeries, zoomRange]);

  const [closingDealId, setClosingDealId] = useState<number | null>(null);
  const [apiKeyFilter, setApiKeyFilter] = useState<number[]>([]);
  const [messageApi, messageContextHolder] = message.useMessage();

  const seriesRef = useRef<PortfolioEquitySeries>(pnlSeries);
  const { getInitialTitle, setTitle: setDocumentTitle } = useDocumentTitle();

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
          startValue: typeof range.startValue === 'number' ? range.startValue : undefined,
          endValue: typeof range.endValue === 'number' ? range.endValue : undefined,
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
    const nextRange = calculateZoomRangeForPreset(pnlSeries, zoomPreset);
    setZoomRange((prev) => {
      if (areZoomRangesEqual(prev, nextRange)) {
        return prev;
      }
      return nextRange;
    });
  }, [pnlSeries, zoomPreset, setZoomRange]);

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

  useEffect(() => {
    const baseTitle = getInitialTitle();
    const pnlLabel = formatSignedCurrency(summary.pnl);
    const nextTitle = baseTitle ? `${pnlLabel}$ — ${baseTitle}` : `${pnlLabel}$`;
    setDocumentTitle(nextTitle);
  }, [getInitialTitle, setDocumentTitle, summary.pnl]);

  const lastUpdatedLabel = useMemo(() => {
    if (!dealsState.lastUpdated) {
      return '—';
    }
    return new Date(dealsState.lastUpdated).toLocaleTimeString();
  }, [dealsState.lastUpdated]);

  const positions = dealsState.positions;

  const uniqueApiKeyIds = useMemo(() => {
    const ids = new Set<number>();
    positions.forEach((position) => {
      ids.add(position.deal.apiKeyId);
    });
    return ids;
  }, [positions]);

  useEffect(() => {
    setApiKeyFilter((prev) => prev.filter((id) => uniqueApiKeyIds.has(id)));
  }, [uniqueApiKeyIds]);

  const apiKeyOptions = useMemo(() => {
    return Array.from(uniqueApiKeyIds)
      .sort((a, b) => a - b)
      .map((id) => {
        const apiKey = apiKeysById.get(id);
        const name = (apiKey?.name ?? '').trim();
        const exchange = apiKey?.exchange ?? '';
        const label = name || `API ключ ${id}${exchange ? ` · ${exchange}` : ''}`;
        return { value: id, label };
      });
  }, [apiKeysById, uniqueApiKeyIds]);

  const filteredPositions = useMemo(() => {
    if (apiKeyFilter.length === 0) {
      return positions;
    }
    const allow = new Set(apiKeyFilter);
    return positions.filter((position) => allow.has(position.deal.apiKeyId));
  }, [apiKeyFilter, positions]);

  const executedOrdersIndex = useMemo(
    () => buildExecutedOrdersIndex(positions.map((position) => position.deal)),
    [positions],
  );
  const executedOrders = executedOrdersIndex.all;
  const executedOrdersByDeal = executedOrdersIndex.byDeal;

  const chartGroupedSeries = groupByApiKey && groupedPnlSeries.length > 0 ? groupedPnlSeries : undefined;
  const [legendSelection, setLegendSelection] = useState<Record<string, boolean>>({ 'Суммарный P&L': true });

  useEffect(() => {
    const names = chartGroupedSeries ? chartGroupedSeries.map((item) => item.label) : ['Суммарный P&L'];
    setLegendSelection((prev) => {
      const next: Record<string, boolean> = {};
      names.forEach((name) => {
        next[name] = Object.hasOwn(prev, name) ? prev[name] : true;
      });
      return next;
    });
  }, [chartGroupedSeries]);

  const handleLegendSelectionChange = useCallback((selection: Record<string, boolean>) => {
    setLegendSelection(selection);
  }, []);

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
          const dealUrl = buildDealStatisticsUrl(record.deal.id);
          return (
            <div className="active-deals__bot-cell">
              <a className="active-deals__bot-link" href={botUrl} target="_blank" rel="noreferrer">
                {botName}
              </a>
              <div className="active-deals__bot-meta">
                <span>{baseAsset}</span>
                <span>·</span>
                <span>{record.deal.algorithm}</span>
                <span>·</span>
                <a href={dealUrl} target="_blank" rel="noreferrer" className="active-deals__id-link-meta">
                  ID {record.deal.id}
                </a>
              </div>
            </div>
          );
        },
      },
      {
        title: 'API ключ',
        dataIndex: ['deal', 'apiKeyId'],
        key: 'apiKey',
        width: 260,
        render: (_value, record) => {
          const apiKey = apiKeysById.get(record.deal.apiKeyId);
          const name = (apiKey?.name ?? '').trim() || `API ключ ${record.deal.apiKeyId}`;
          const exchange = apiKey?.exchange ?? record.deal.exchange ?? record.deal.pair?.exchange ?? '—';
          return (
            <div className="active-deals__api-key-cell">
              <span className="active-deals__api-key-name">{name}</span>
              <div className="active-deals__bot-meta">
                <span>{exchange}</span>
                <span>·</span>
                <span>ID {record.deal.apiKeyId}</span>
              </div>
            </div>
          );
        },
        sorter: (a, b) => {
          const left = (apiKeysById.get(a.deal.apiKeyId)?.name ?? String(a.deal.apiKeyId)).trim();
          const right = (apiKeysById.get(b.deal.apiKeyId)?.name ?? String(b.deal.apiKeyId)).trim();
          return left.localeCompare(right, 'ru');
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
        title: 'Экспозиция',
        dataIndex: 'exposure',
        key: 'exposure',
        align: 'right',
        width: 140,
        sorter: (a, b) => a.exposure - b.exposure,
        render: (_value, record) => formatCurrency(record.exposure),
      },
      {
        title: 'Динамика',
        key: 'pnlTrend',
        width: 140,
        render: (_value, record) => {
          const history = positionHistory.get(record.deal.id) ?? [];
          const windowedHistory = filterHistoryByWindow(history, zoomTimeWindow);
          if (windowedHistory.length === 0) {
            return (
              <div className="deal-sparkline-cell">
                <span className="deal-sparkline-cell__empty">—</span>
              </div>
            );
          }
          const points: SparklinePoint[] = windowedHistory.map((item) => ({ time: item.time, value: item.pnl }));
          const dealOrders = executedOrdersByDeal.get(record.deal.id) ?? [];

          if (dealsState.lastUpdated) {
            const lastUpdatedTime = new Date(dealsState.lastUpdated).getTime();
            const lastTime = points.length > 0 ? points[points.length - 1].time : 0;
            // Only append if the update time is newer than the last history point
            // and within or after the window (though sparkline handles clipping)
            if (lastUpdatedTime > lastTime) {
              points.push({ time: lastUpdatedTime, value: record.pnl });
            }
          }
          const markers = buildSparklineMarkers(dealOrders, points, zoomTimeWindow);

          return (
            <div className="deal-sparkline-cell">
              <Sparkline
                points={points}
                markers={markers}
                ariaLabel={`Динамика P&L сделки ${record.deal.id}`}
                minTime={zoomTimeWindow?.start}
                maxTime={zoomTimeWindow?.end}
              />
            </div>
          );
        },
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
          const nearestOrderDigits = countFractionDigits(record.nearestOpenOrderPrice ?? Number.NaN);
          const alignedDigits = Math.max(entryDigits, markDigits, nearestOrderDigits);
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
              {record.nearestOpenOrderPrice !== null && (
                <div className="active-deals__price-row">
                  <span className="active-deals__price-label">Ближ. ордер</span>
                  <span className="active-deals__price-value">
                    {formatPriceWithDigits(record.nearestOpenOrderPrice, alignedDigits)}
                  </span>
                </div>
              )}
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
        title: 'Время в сделке',
        key: 'lifetime',
        width: 160,
        sorter: (a, b) => {
          const reference = Date.now();
          const left = getDealLifetimeMs(a.deal, reference) ?? 0;
          const right = getDealLifetimeMs(b.deal, reference) ?? 0;
          return left - right;
        },
        render: (_value, record) => formatDealLifetime(record.deal),
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
        sorter: (a, b) => a.executedOrdersCount - b.executedOrdersCount,
        render: (_value, record) => `${record.executedOrdersCount}/${record.totalOrdersCount}`,
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
              <Button
                className={`active-deals__close-button ${buttonToneClass}`}
                disabled={actionsDisabled}
                loading={isClosing}
              >
                Закрыть
              </Button>
            </Popconfirm>
          );
        },
      },
    ],
    [
      apiKeysById,
      closingDealId,
      executedOrdersByDeal,
      handleCloseDeal,
      positionHistory,
      zoomTimeWindow,
      dealsState.lastUpdated,
    ],
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
        <PageHeader
          title="Активные сделки"
          description="Сводка открытых позиций с автоматическим обновлением и агрегированным P&amp;L."
          extra={
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
          }
          className="page__header"
        ></PageHeader>

        {!extensionReady && (
          <div className="banner banner--warning">
            Расширение Veles Tools неактивно. Откройте интерфейс из расширения, чтобы получить доступ к активным
            сделкам.
          </div>
        )}

        <Card title="Основные показатели" bordered>
          <div className="aggregation-summary">
            <StatisticCard
              title="Суммарный P&L"
              value={summary.pnl}
              trend={summary.pnl >= 0 ? 'positive' : 'negative'}
              formatter={(rawValue) => {
                const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
                if (!Number.isFinite(numeric)) {
                  return '—';
                }
                return `${formatSignedCurrency(numeric)} USDT`;
              }}
            />
            <StatisticCard
              title="Экспозиция"
              tooltip={
                <InfoTooltip text="Совокупный объём позиций: сумма |количество| × средняя цена входа по каждой сделке." />
              }
              value={summary.exposure}
              formatter={(rawValue) => {
                const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
                if (!Number.isFinite(numeric)) {
                  return '—';
                }
                return `${formatCurrency(numeric)} USDT`;
              }}
            />
            <StatisticCard
              title="Всего сделок"
              tooltip={<InfoTooltip text="Количество активных сделок, полученных из эндпоинта /api/cycles/active." />}
              value={dealsState.totalDeals}
              precision={0}
            />
            <StatisticCard
              title="В плюсе"
              tooltip={<InfoTooltip text="Число сделок с положительным текущим P&L." />}
              value={summary.profitable}
              precision={0}
            />
            <StatisticCard
              title="В минусе"
              tooltip={<InfoTooltip text="Число сделок с отрицательным текущим P&L." />}
              value={summary.losing}
              precision={0}
            />
            <StatisticCard
              title="Без изменений"
              tooltip={<InfoTooltip text="Сделки, у которых рассчитанный P&L равен нулю." />}
              value={summary.flat}
              precision={0}
            />
            <StatisticCard title="Обновлено" value={lastUpdatedLabel} trend="muted" />
          </div>
        </Card>

        <Card title="Динамика агрегированного P&amp;L" bordered>
          <div className="panel__header" style={{ paddingBottom: 12 }}>
            <p className="panel__description">
              На графике отображается история суммарного результата портфеля с выбранным интервалом обновления. История
              накапливается только когда вкладка с расширением открыта.
            </p>
            <div
              className="panel__actions"
              style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', width: '100%' }}
            >
              <Space className="chart-zoom-presets" align="center" size="middle" wrap>
                <Segmented
                  options={ACTIVE_DEALS_ZOOM_PRESET_OPTIONS.map((preset) => ({
                    label: preset.label,
                    value: preset.key,
                  }))}
                  value={zoomPreset}
                  size="middle"
                  onChange={(value) => applyZoomPreset(value as ActiveDealsZoomPresetKey)}
                />
                <Button onClick={handleResetHistory}>Сбросить данные</Button>
              </Space>
              <Space align="center" size="middle">
                <Switch
                  checked={groupByApiKey}
                  onChange={(checked) => setGroupByApiKey(checked)}
                  aria-label="Группировка по ключу"
                />
                <span>Группировка по ключу</span>
              </Space>
            </div>
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
                groupedSeries={chartGroupedSeries}
                executedOrders={executedOrders}
                legendSelection={legendSelection}
                onLegendSelectionChange={handleLegendSelectionChange}
                filterVisibleRange
              />
            )}
          </div>
        </Card>

        <Card title="Список сделок">
          <div className="panel__header" style={{ paddingBottom: 12 }}>
            <div
              className="panel__actions"
              style={{
                display: 'flex',
                gap: 12,
                width: '100%',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Select
                mode="multiple"
                allowClear
                placeholder="Все API ключи"
                style={{ minWidth: 240 }}
                options={apiKeyOptions}
                value={apiKeyFilter}
                onChange={(values) => setApiKeyFilter((values as number[]) ?? [])}
                maxTagCount="responsive"
              />
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
              dataSource={filteredPositions}
              rowKey={(record) => record.deal.id}
              pagination={false}
              loading={loading}
              locale={{ emptyText: 'Активных сделок нет.' }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        </Card>
      </section>
    </>
  );
};

export default ActiveDealsPage;
