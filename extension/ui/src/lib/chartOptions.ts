import type {
  BarSeriesOption,
  DataZoomComponentOption,
  EChartsOption,
  LineSeriesOption,
  ScatterSeriesOption,
} from 'echarts';
import type {
  AggregateRiskSeries,
  DailyConcurrencyRecord,
  DailyConcurrencyStats,
  ExecutedOrderPoint,
  PortfolioEquityGroupedSeriesItem,
  PortfolioEquitySeries,
} from './aggregationTypes';

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
});

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const GROUPED_SERIES_COLOR_PALETTE = [
  '#2563eb',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#ef4444',
  '#0ea5e9',
  '#84cc16',
  '#fb7185',
  '#facc15',
  '#22d3ee',
  '#d946ef',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#e11d48',
  '#6366f1',
  '#059669',
  '#f472b6',
  '#65a30d',
  '#0284c7',
] as const;

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return numberFormatter.format(value);
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const resolveGroupColorIndex = (group: PortfolioEquityGroupedSeriesItem, fallbackIndex: number): number => {
  if (typeof group.apiKeyId === 'number') {
    return Math.abs(group.apiKeyId) % GROUPED_SERIES_COLOR_PALETTE.length;
  }
  if (group.id) {
    return hashString(group.id) % GROUPED_SERIES_COLOR_PALETTE.length;
  }
  return fallbackIndex % GROUPED_SERIES_COLOR_PALETTE.length;
};

const resolveGroupColor = (group: PortfolioEquityGroupedSeriesItem, fallbackIndex: number): string => {
  const paletteIndex = resolveGroupColorIndex(group, fallbackIndex);
  return GROUPED_SERIES_COLOR_PALETTE[paletteIndex];
};

type ChartThemeMode = 'light' | 'dark';

interface ChartPalette {
  axisLabel: string;
  axisLine: string;
  splitLine: string;
  tooltipBackground: string;
  tooltipBorder: string;
  tooltipText: string;
  zeroLine: string;
  zeroLabel: string;
  zeroLabelBackground: string;
  concurrencyMarkLine: string;
  concurrencyMarkLabel: string;
  concurrencyMarkBackground: string;
  legendInactive: string;
}

const resolveChartPalette = (mode?: ChartThemeMode): ChartPalette => {
  if (mode === 'dark') {
    return {
      axisLabel: '#cbd5e1',
      axisLine: 'rgba(148, 163, 184, 0.4)',
      splitLine: 'rgba(148, 163, 184, 0.2)',
      tooltipBackground: 'rgba(15, 23, 42, 0.92)',
      tooltipBorder: 'rgba(148, 163, 184, 0.25)',
      tooltipText: '#e2e8f0',
      zeroLine: 'rgba(148, 163, 184, 0.6)',
      zeroLabel: '#e2e8f0',
      zeroLabelBackground: 'rgba(30, 41, 59, 0.85)',
      concurrencyMarkLine: 'rgba(129, 140, 248, 0.8)',
      concurrencyMarkLabel: '#e2e8f0',
      concurrencyMarkBackground: 'rgba(30, 41, 59, 0.8)',
      legendInactive: 'rgba(226, 232, 240, 0.45)',
    };
  }
  return {
    axisLabel: '#475569',
    axisLine: '#cbd5f5',
    splitLine: '#e2e8f0',
    tooltipBackground: 'rgba(255, 255, 255, 0.95)',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#1e293b',
    zeroLine: '#94a3b8',
    zeroLabel: '#475569',
    zeroLabelBackground: 'rgba(241, 245, 249, 0.8)',
    concurrencyMarkLine: '#6366f1',
    concurrencyMarkLabel: '#4338ca',
    concurrencyMarkBackground: 'rgba(224, 231, 255, 0.9)',
    legendInactive: 'rgba(71, 85, 105, 0.6)',
  };
};

const buildZeroLine = (series: PortfolioEquitySeries, palette: ChartPalette): LineSeriesOption['markLine'] => {
  const hasPositive = series.points.some((point) => point.value >= 0);
  const hasNegative = series.points.some((point) => point.value <= 0);
  if (!(hasPositive && hasNegative)) {
    return undefined;
  }
  return {
    symbol: 'none',
    lineStyle: {
      color: palette.zeroLine,
      type: 'dashed',
      width: 1,
    },
    label: {
      formatter: '0',
      color: palette.zeroLabel,
      backgroundColor: palette.zeroLabelBackground,
      padding: [2, 4],
      borderRadius: 4,
    },
    data: [{ yAxis: 0 }],
  } satisfies LineSeriesOption['markLine'];
};

export interface DataZoomRange {
  start?: number;
  end?: number;
  startValue?: number;
  endValue?: number;
}

const buildZeroLineForGroups = (
  groups: PortfolioEquityGroupedSeriesItem[],
  palette: ChartPalette,
): LineSeriesOption['markLine'] | undefined => {
  let hasPositive = false;
  let hasNegative = false;

  groups.forEach((group) => {
    group.series.points.forEach((point) => {
      if (point.value >= 0) {
        hasPositive = true;
      }
      if (point.value <= 0) {
        hasNegative = true;
      }
    });
  });

  if (!(hasPositive && hasNegative)) {
    return undefined;
  }

  return {
    symbol: 'none',
    lineStyle: {
      color: palette.zeroLine,
      type: 'dashed',
      width: 1,
    },
    label: {
      formatter: '0',
      color: palette.zeroLabel,
      backgroundColor: palette.zeroLabelBackground,
      padding: [2, 4],
      borderRadius: 4,
    },
    data: [{ yAxis: 0 }],
  } satisfies LineSeriesOption['markLine'];
};

const applyRange = (base: DataZoomComponentOption, range?: DataZoomRange): DataZoomComponentOption => {
  if (!range) {
    return base;
  }
  const next: DataZoomComponentOption = { ...base };
  if (typeof range.startValue === 'number') {
    delete next.start;
    next.startValue = range.startValue;
  } else if (typeof range.start === 'number') {
    next.start = range.start;
  }
  if (typeof range.endValue === 'number') {
    delete next.end;
    next.endValue = range.endValue;
  } else if (typeof range.end === 'number') {
    next.end = range.end;
  }
  return next;
};

const disableWheelInteraction = <T extends DataZoomComponentOption>(option: T): T => {
  return {
    ...option,
    zoomOnMouseWheel: false,
    moveOnMouseWheel: false,
    moveOnMouseMove: false,
  } as T;
};

const buildDataZoomComponents = (
  range?: DataZoomRange,
  filterMode: DataZoomComponentOption['filterMode'] = 'none',
): DataZoomComponentOption[] => {
  const insideZoom = applyRange(
    disableWheelInteraction({
      type: 'inside',
      throttle: 30,
      filterMode,
    }),
    range,
  );

  const sliderZoom = applyRange(
    disableWheelInteraction({
      type: 'slider',
      bottom: 40,
      filterMode,
    }),
    range,
  );

  return [insideZoom, sliderZoom];
};

const interpolateValue = (series: PortfolioEquitySeries, time: number): number | null => {
  const points = series.points;
  if (points.length === 0) {
    return null;
  }
  if (time < points[0].time) {
    return null;
  }
  if (time > points[points.length - 1].time) {
    return null;
  }

  let left = 0;
  let right = points.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (points[mid].time === time) {
      return points[mid].value;
    }
    if (points[mid].time < time) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  const p1 = points[right];
  const p2 = points[left];

  if (!(p1 && p2)) {
    return null;
  }

  const tRatio = (time - p1.time) / (p2.time - p1.time);
  return p1.value + (p2.value - p1.value) * tRatio;
};

const buildOrderScatterSeries = (
  orders: ExecutedOrderPoint[],
  series: PortfolioEquitySeries,
  name: string,
): ScatterSeriesOption => {
  const data = orders
    .map((order) => {
      const value = interpolateValue(series, order.time);
      if (value === null) {
        return null;
      }

      const isEntry = order.type === 'ENTRY';
      const color = isEntry ? '#10b981' : '#ef4444';

      return {
        value: [order.time, value],
        itemStyle: {
          color,
          borderColor: '#fff',
          borderWidth: 1,
        },
        customData: order,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    name,
    type: 'scatter',
    symbol: 'circle',
    symbolSize: 8,
    z: 10,
    cursor: 'default',
    data,
  };
};

const formatEquityTooltip = (params: any): string => {
  const items = Array.isArray(params) ? params : [params];
  const orderItem = items.find((item: any) => item.seriesType === 'scatter' && item.data?.customData);

  if (orderItem) {
    const order = orderItem.data.customData as ExecutedOrderPoint;
    const isEntry = order.type === 'ENTRY';
    const typeLabel = isEntry ? 'Сделка открыта' : 'Усреднение';
    const color = isEntry ? '#10b981' : '#ef4444';
    const totalValue = order.price * order.quantity;

    return `
      <div class="chart-tooltip" style="--tooltip-accent: ${color};">
        <div class="chart-tooltip__title">${order.pair}</div>
        <div class="chart-tooltip__row">
          <span class="chart-tooltip__dot"></span>
          <span class="chart-tooltip__accent">${typeLabel}</span>
        </div>
        <div class="chart-tooltip__grid">
          <span class="chart-tooltip__label">Цена:</span>
          <span class="chart-tooltip__value">${formatNumber(order.price)}</span>

          <span class="chart-tooltip__label">Кол-во:</span>
          <span class="chart-tooltip__value">${order.quantity}</span>

          <span class="chart-tooltip__label">Сумма:</span>
          <span class="chart-tooltip__value">${formatNumber(totalValue)}</span>

          <span class="chart-tooltip__label">Позиция:</span>
          <span class="chart-tooltip__value">${formatNumber(order.positionVolume)}</span>
        </div>
        <div class="chart-tooltip__footer">
          ${order.botName} <span class="chart-tooltip__divider">·</span> ID ${order.dealId}
        </div>
      </div>
    `;
  }

  if (items.length === 0) return '';
  const dateLabel = dateTimeFormatter.format(new Date(items[0].axisValue));
  const list = items
    .map((item: any) => {
      const value = item.value?.[1] ?? item.value;
      if (value === null || value === undefined) return '';
      return `
        <div class="chart-tooltip__item">
          <div class="chart-tooltip__item-meta">
            ${item.marker}
            <span class="chart-tooltip__label">${item.seriesName}</span>
          </div>
          <span class="chart-tooltip__value">${formatNumber(Number(value))}</span>
        </div>
      `;
    })
    .join('');

  return `
    <div class="chart-tooltip">
      <div class="chart-tooltip__date">${dateLabel}</div>
      ${list}
    </div>
  `;
};

const LEGEND_SCROLL_THRESHOLD = 12;

export const createPortfolioEquityChartOptions = (
  series: PortfolioEquitySeries,
  range?: DataZoomRange,
  groupedSeries?: PortfolioEquityGroupedSeriesItem[],
  executedOrders?: ExecutedOrderPoint[],
  legendSelection?: Record<string, boolean>,
  filterMode: DataZoomComponentOption['filterMode'] = 'none',
  themeMode?: ChartThemeMode,
  hideLegend: boolean = false,
): EChartsOption => {
  const palette = resolveChartPalette(themeMode);
  if (groupedSeries && groupedSeries.length > 0) {
    const lineSeries: LineSeriesOption[] = groupedSeries.map((group, index) => {
      const color = resolveGroupColor(group, index);
      return {
        id: group.id,
        name: group.label,
        type: 'line',
        showSymbol: false,
        smooth: false,
        symbol: 'none',
        color,
        lineStyle: {
          width: 1.6,
          color,
        },
        itemStyle: {
          color,
        },
        emphasis: { focus: 'series' },
        data: group.series.points.map((point) => [point.time, point.value]),
      };
    });

    const zeroLine = buildZeroLineForGroups(groupedSeries, palette);
    if (zeroLine && lineSeries.length > 0) {
      lineSeries[0].markLine = zeroLine;
    }

    const scatterSeries: ScatterSeriesOption[] = [];
    if (executedOrders && executedOrders.length > 0) {
      groupedSeries.forEach((group) => {
        const groupOrders = executedOrders.filter((o) => o.apiKeyId === group.apiKeyId);
        if (groupOrders.length > 0) {
          scatterSeries.push(buildOrderScatterSeries(groupOrders, group.series, group.label));
        }
      });
    }

    return {
      animation: false,
      grid: { left: 60, right: 24, top: 16, bottom: 92 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        order: 'valueDesc',
        backgroundColor: palette.tooltipBackground,
        borderColor: palette.tooltipBorder,
        textStyle: { color: palette.tooltipText, fontSize: 12 },
        padding: [8, 12],
        formatter: formatEquityTooltip,
      },
      legend: {
        show: !hideLegend,
        type: groupedSeries.length > LEGEND_SCROLL_THRESHOLD ? 'scroll' : 'plain',
        bottom: 0,
        icon: 'roundRect',
        data: groupedSeries.map((group) => group.label),
        selected: legendSelection,
        inactiveColor: palette.legendInactive,
        pageIconColor: palette.axisLabel,
        pageIconInactiveColor: palette.legendInactive,
        pageTextStyle: { color: palette.axisLabel },
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value: number) => dateTimeFormatter.format(new Date(value)),
          color: palette.axisLabel,
        },
        axisLine: {
          lineStyle: { color: palette.axisLine },
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatNumber(value),
          color: palette.axisLabel,
        },
        axisLine: {
          lineStyle: { color: palette.axisLine },
        },
        splitLine: {
          lineStyle: {
            type: 'dashed',
            color: palette.splitLine,
          },
        },
      },
      dataZoom: buildDataZoomComponents(range, filterMode),
      series: [...lineSeries, ...scatterSeries],
    } satisfies EChartsOption;
  }

  const equityData = series.points.map((point) => [point.time, point.value]);
  const positiveAreaData = series.points.map((point) =>
    point.value > 0 ? [point.time, point.value] : [point.time, null],
  );
  const negativeAreaData = series.points.map((point) =>
    point.value < 0 ? [point.time, point.value] : [point.time, null],
  );

  const markLine = buildZeroLine(series, palette);

  const positiveAreaSeries: LineSeriesOption = {
    id: 'active-deals-positive-area',
    name: 'positive-area',
    type: 'line',
    showSymbol: false,
    silent: true,
    connectNulls: false,
    lineStyle: { width: 0 },
    areaStyle: {
      color: 'rgba(22, 163, 74, 0.25)',
    },
    itemStyle: {
      color: 'rgba(22, 163, 74, 0.25)',
    },
    emphasis: { focus: 'none' },
    tooltip: { show: false },
    smooth: false,
    clip: true,
    z: 1,
    data: positiveAreaData,
  };

  const negativeAreaSeries: LineSeriesOption = {
    id: 'active-deals-negative-area',
    name: 'negative-area',
    type: 'line',
    showSymbol: false,
    silent: true,
    connectNulls: false,
    lineStyle: { width: 0 },
    areaStyle: {
      color: 'rgba(220, 38, 38, 0.25)',
    },
    itemStyle: {
      color: 'rgba(220, 38, 38, 0.25)',
    },
    emphasis: { focus: 'none' },
    tooltip: { show: false },
    smooth: false,
    clip: true,
    z: 1,
    data: negativeAreaData,
  };

  const equitySeries: LineSeriesOption = {
    id: 'active-deals-equity-line',
    name: 'Суммарный P&L',
    type: 'line',
    symbol: 'none',
    lineStyle: {
      color: 'rgba(15, 23, 42, 0.7)',
      width: 1.6,
    },
    itemStyle: {
      color: 'rgba(15, 23, 42, 0.7)',
    },
    z: 4,
    emphasis: { focus: 'series' },
    data: equityData,
    markLine,
  };

  let scatterSeries: ScatterSeriesOption | undefined;
  if (executedOrders && executedOrders.length > 0) {
    scatterSeries = buildOrderScatterSeries(executedOrders, series, 'Суммарный P&L');
  }

  return {
    animation: false,
    grid: { left: 60, right: 24, top: 16, bottom: 92 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      order: 'valueDesc',
      backgroundColor: palette.tooltipBackground,
      borderColor: palette.tooltipBorder,
      textStyle: { color: palette.tooltipText, fontSize: 12 },
      padding: [8, 12],
      formatter: formatEquityTooltip,
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      data: ['Суммарный P&L'],
      selected: legendSelection,
      inactiveColor: palette.legendInactive,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => dateTimeFormatter.format(new Date(value)),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatNumber(value),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: palette.splitLine,
        },
      },
    },
    dataZoom: buildDataZoomComponents(range, filterMode),
    series: [positiveAreaSeries, negativeAreaSeries, equitySeries, ...(scatterSeries ? [scatterSeries] : [])],
  } satisfies EChartsOption;
};

export const createAggregateRiskChartOptions = (
  series: AggregateRiskSeries,
  range?: DataZoomRange,
  filterMode: DataZoomComponentOption['filterMode'] = 'none',
  themeMode?: ChartThemeMode,
): EChartsOption => {
  const palette = resolveChartPalette(themeMode);
  const riskData = series.points.map((point) => [point.time, point.value]);

  const riskSeries: LineSeriesOption = {
    name: 'Суммарное МПУ',
    type: 'line',
    showSymbol: false,
    smooth: false,
    lineStyle: {
      color: 'rgba(220, 38, 38, 0.85)',
      width: 1.6,
    },
    itemStyle: {
      color: 'rgba(220, 38, 38, 0.85)',
    },
    areaStyle: {
      color: 'rgba(220, 38, 38, 0.2)',
    },
    markLine: {
      symbol: 'none',
      lineStyle: {
        color: palette.zeroLine,
        type: 'dashed',
        width: 1,
      },
      label: {
        formatter: '0',
        color: palette.zeroLabel,
        backgroundColor: palette.zeroLabelBackground,
        padding: [2, 4],
        borderRadius: 4,
      },
      data: [{ yAxis: 0 }],
    },
    emphasis: { focus: 'series' },
    data: riskData,
  } satisfies LineSeriesOption;

  return {
    animation: false,
    grid: { left: 60, right: 24, top: 16, bottom: 92 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value) => formatNumber(Number(value)),
      order: 'valueDesc',
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      data: ['Суммарное МПУ'],
      inactiveColor: palette.legendInactive,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value) => dateTimeFormatter.format(new Date(value)),
        color: palette.axisLabel,
      },
      splitLine: {
        show: true,
        lineStyle: { color: palette.splitLine },
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        formatter: (value) => formatNumber(Number(value)),
        color: palette.axisLabel,
      },
      splitLine: {
        show: true,
        lineStyle: { color: palette.splitLine },
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    dataZoom: buildDataZoomComponents(range, filterMode),
    series: [riskSeries],
  } satisfies EChartsOption;
};

export interface LimitImpactPoint {
  label: string;
  totalPnl: number;
  aggregateDrawdown: number;
  aggregateMPU: number;
  aggregateWorstRisk: number;
  aggregateRiskEfficiency: number | null;
}

export const createLimitImpactChartOptions = (
  points: LimitImpactPoint[],
  themeMode?: ChartThemeMode,
): EChartsOption => {
  const palette = resolveChartPalette(themeMode);
  const categories = points.map((point) => point.label);

  const pnlSeries: LineSeriesOption = {
    name: 'Суммарный P&L',
    type: 'line',
    smooth: false,
    showSymbol: true,
    symbolSize: 8,
    lineStyle: {
      color: '#1d4ed8',
      width: 1.8,
    },
    itemStyle: {
      color: '#1d4ed8',
    },
    emphasis: { focus: 'series' },
    data: points.map((point) => point.totalPnl),
  } satisfies LineSeriesOption;

  const drawdownSeries: LineSeriesOption = {
    name: 'Макс. суммарная просадка',
    type: 'line',
    smooth: false,
    showSymbol: true,
    symbolSize: 8,
    lineStyle: {
      color: '#dc2626',
      width: 1.6,
    },
    itemStyle: {
      color: '#dc2626',
    },
    emphasis: { focus: 'series' },
    data: points.map((point) => point.aggregateDrawdown),
  } satisfies LineSeriesOption;

  const riskSeries: LineSeriesOption = {
    name: 'Макс. суммарное МПУ',
    type: 'line',
    smooth: false,
    showSymbol: true,
    symbolSize: 8,
    lineStyle: {
      color: '#f97316',
      width: 1.6,
    },
    itemStyle: {
      color: '#f97316',
    },
    emphasis: { focus: 'series' },
    data: points.map((point) => point.aggregateMPU),
  } satisfies LineSeriesOption;

  return {
    animation: false,
    grid: { left: 60, right: 24, top: 16, bottom: 76 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value) => formatNumber(Number(value)),
      order: 'valueDesc',
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      data: ['Суммарный P&L', 'Макс. суммарная просадка', 'Макс. суммарное МПУ'],
      inactiveColor: palette.legendInactive,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        formatter: (value) => `≤ ${value}`,
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => formatNumber(Number(value)),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
      splitLine: {
        show: true,
        lineStyle: { color: palette.splitLine },
      },
    },
    series: [pnlSeries, drawdownSeries, riskSeries],
  } satisfies EChartsOption;
};

export const createLimitEfficiencyChartOptions = (
  points: LimitImpactPoint[],
  themeMode?: ChartThemeMode,
): EChartsOption => {
  const palette = resolveChartPalette(themeMode);
  const categories = points.map((point) => point.label);

  const efficiencySeries: LineSeriesOption = {
    name: 'P&L / макс. риск',
    type: 'line',
    smooth: false,
    showSymbol: true,
    symbolSize: 8,
    connectNulls: false,
    lineStyle: {
      color: '#0f766e',
      width: 1.8,
    },
    itemStyle: {
      color: '#14b8a6',
    },
    emphasis: { focus: 'series' },
    data: points.map((point) =>
      Number.isFinite(point.aggregateRiskEfficiency ?? Number.NaN) ? point.aggregateRiskEfficiency : null,
    ),
  } satisfies LineSeriesOption;

  return {
    animation: false,
    grid: { left: 60, right: 24, top: 16, bottom: 76 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      valueFormatter: (value) => formatNumber(Number(value)),
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      data: ['P&L / макс. риск'],
      inactiveColor: palette.legendInactive,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        formatter: (value) => `≤ ${value}`,
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => formatNumber(Number(value)),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
      splitLine: {
        show: true,
        lineStyle: { color: palette.splitLine },
      },
    },
    series: [efficiencySeries],
  } satisfies EChartsOption;
};

type BarMarkLine = NonNullable<BarSeriesOption['markLine']>;
type BarMarkLineData = NonNullable<BarMarkLine['data']>;

const buildConcurrencyMarkLine = (
  stats: DailyConcurrencyStats | undefined,
  palette: ChartPalette,
): BarSeriesOption['markLine'] => {
  if (!stats) {
    return undefined;
  }
  const data: BarMarkLineData = [];

  const pushLimit = (label: string, value: number): void => {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    data.push({ name: label, yAxis: value });
  };

  pushLimit('P75', stats.limits.p75);
  pushLimit('P90', stats.limits.p90);
  pushLimit('P95', stats.limits.p95);

  if (data.length === 0) {
    return undefined;
  }

  return {
    symbol: 'none',
    lineStyle: {
      type: 'dashed',
      color: palette.concurrencyMarkLine,
      width: 1,
    },
    label: {
      color: palette.concurrencyMarkLabel,
      formatter: ({ value, name }) => `${name ?? ''}: ${formatNumber(Number(value))}`,
      backgroundColor: palette.concurrencyMarkBackground,
      padding: [2, 6],
      borderRadius: 4,
    },
    data,
  } satisfies BarSeriesOption['markLine'];
};

export const createDailyConcurrencyChartOptions = (
  records: DailyConcurrencyRecord[],
  stats?: DailyConcurrencyStats,
  range?: DataZoomRange,
  filterMode: DataZoomComponentOption['filterMode'] = 'none',
  themeMode?: ChartThemeMode,
): EChartsOption => {
  const palette = resolveChartPalette(themeMode);
  const chartData = records.map((record) => [record.dayStartMs, record.maxCount]);

  const markLine = buildConcurrencyMarkLine(stats, palette);

  const barSeries: BarSeriesOption = {
    name: 'Максимум позиций',
    type: 'bar',
    barWidth: '55%',
    itemStyle: {
      color: 'rgba(79, 70, 229, 0.75)',
    },
    emphasis: {
      itemStyle: {
        color: 'rgba(55, 48, 163, 0.9)',
      },
    },
    data: chartData,
    markLine,
  };

  return {
    animation: false,
    grid: { left: 52, right: 24, top: 20, bottom: 80 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatNumber(Number(value)),
    },
    legend: {
      bottom: 16,
      icon: 'roundRect',
      data: ['Максимум позиций'],
      inactiveColor: palette.legendInactive,
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => dateFormatter.format(new Date(value)),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: {
        formatter: (value: number) => formatNumber(value),
        color: palette.axisLabel,
      },
      axisLine: {
        lineStyle: { color: palette.axisLine },
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
          color: palette.splitLine,
        },
      },
    },
    dataZoom: buildDataZoomComponents(range, filterMode),
    series: [barSeries],
  } satisfies EChartsOption;
};
