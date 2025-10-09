import type {
  BarSeriesOption,
  DataZoomComponentOption,
  EChartsOption,
  LineSeriesOption,
} from 'echarts';
import type {
  AggregateRiskSeries,
  DailyConcurrencyRecord,
  DailyConcurrencyStats,
  PortfolioEquitySeries,
} from './backtestAggregation';

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

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return numberFormatter.format(value);
};

const buildZeroLine = (series: PortfolioEquitySeries): LineSeriesOption['markLine'] => {
  const hasPositive = series.points.some((point) => point.value >= 0);
  const hasNegative = series.points.some((point) => point.value <= 0);
  if (!hasPositive || !hasNegative) {
    return undefined;
  }
  return {
    symbol: 'none',
    lineStyle: {
      color: '#94a3b8',
      type: 'dashed',
      width: 1,
    },
    label: {
      formatter: '0',
      color: '#475569',
      backgroundColor: 'rgba(241, 245, 249, 0.8)',
      padding: [2, 4],
      borderRadius: 4,
    },
    data: [{ yAxis: 0 }],
  } satisfies LineSeriesOption['markLine'];
};

export interface DataZoomRange {
  start?: number;
  end?: number;
}

const applyRange = (
  base: DataZoomComponentOption,
  range?: DataZoomRange,
): DataZoomComponentOption => {
  if (!range) {
    return base;
  }
  const next: DataZoomComponentOption = { ...base };
  if (typeof range.start === 'number') {
    next.start = range.start;
  }
  if (typeof range.end === 'number') {
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

const buildDataZoomComponents = (range?: DataZoomRange): DataZoomComponentOption[] => {
  const insideZoom = applyRange(
    disableWheelInteraction({
      type: 'inside',
      throttle: 30,
    }),
    range,
  );

  const sliderZoom = applyRange(
    disableWheelInteraction({
      type: 'slider',
      bottom: 40,
    }),
    range,
  );

  return [insideZoom, sliderZoom];
};

export const createPortfolioEquityChartOptions = (
  series: PortfolioEquitySeries,
  range?: DataZoomRange,
): EChartsOption => {
  const equityData = series.points.map((point) => [point.time, point.value]);
  const positiveAreaData = series.points.map((point) =>
    point.value > 0 ? [point.time, point.value] : [point.time, null],
  );
  const negativeAreaData = series.points.map((point) =>
    point.value < 0 ? [point.time, point.value] : [point.time, null],
  );

  const markLine = buildZeroLine(series);

  const positiveAreaSeries: LineSeriesOption = {
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
      data: ['Суммарный P&L'],
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => dateTimeFormatter.format(new Date(value)),
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatNumber(value),
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    dataZoom: buildDataZoomComponents(range),
    series: [positiveAreaSeries, negativeAreaSeries, equitySeries],
  } satisfies EChartsOption;
};

export const createAggregateRiskChartOptions = (
  series: AggregateRiskSeries,
  range?: DataZoomRange,
): EChartsOption => {
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
        color: '#94a3b8',
        type: 'dashed',
        width: 1,
      },
      label: {
        formatter: '0',
        color: '#475569',
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
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
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value) => dateTimeFormatter.format(new Date(value)),
      },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(148, 163, 184, 0.2)' },
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      axisLabel: {
        formatter: (value) => formatNumber(Number(value)),
      },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(148, 163, 184, 0.2)' },
      },
    },
    dataZoom: buildDataZoomComponents(range),
    series: [riskSeries],
  } satisfies EChartsOption;
};

type BarMarkLine = NonNullable<BarSeriesOption['markLine']>;
type BarMarkLineData = NonNullable<BarMarkLine['data']>;

const buildConcurrencyMarkLine = (
  stats?: DailyConcurrencyStats,
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
      color: '#6366f1',
      width: 1,
    },
    label: {
      color: '#4338ca',
      formatter: ({ value, name }) => `${name ?? ''}: ${formatNumber(Number(value))}`,
      backgroundColor: 'rgba(224, 231, 255, 0.9)',
      padding: [2, 6],
      borderRadius: 4,
    },
    data,
  } satisfies BarSeriesOption['markLine'];
};

export const createDailyConcurrencyChartOptions = (
  records: DailyConcurrencyRecord[],
  stats?: DailyConcurrencyStats,
): EChartsOption => {
  const chartData = records.map((record) => [record.dayStartMs, record.maxCount]);

  const markLine = buildConcurrencyMarkLine(stats);

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
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter: (value: number) => dateFormatter.format(new Date(value)),
      },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: {
        formatter: (value: number) => formatNumber(value),
      },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
    },
    dataZoom: buildDataZoomComponents(),
    series: [barSeries],
  } satisfies EChartsOption;
};
