import type { CustomSeriesRenderItem, CustomSeriesRenderItemReturn, EChartsOption } from 'echarts';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useThemeMode } from '../../context/ThemeContext';
import { formatAmount } from '../../lib/backtestFormatting';
import type { DealTimelineRow } from '../../types/backtestAggregations';

interface BacktestDealsTimelineChartProps {
  rows: DealTimelineRow[];
}

type TimelineSeriesDatum = {
  value: [number, number, number];
  backtestName: string;
  quoteCurrency: string;
  status: DealTimelineRow['items'][number]['status'];
  limitedByConcurrency: boolean;
  net: number;
  start: number;
  end: number;
};

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const MS_IN_HOUR = 60 * 60 * 1000;
const MS_IN_DAY = 24 * MS_IN_HOUR;
const ROW_BAR_THICKNESS = 8;
const ROW_GAP = ROW_BAR_THICKNESS / 2;

const resolveSegmentColor = (datum: TimelineSeriesDatum): string => {
  if (datum.status === 'STARTED') {
    return '#2563eb';
  }
  const isProfit = datum.net >= 0;
  if (isProfit) {
    return datum.limitedByConcurrency ? 'rgba(34,197,94,0.35)' : '#22c55e';
  }
  return datum.limitedByConcurrency ? 'rgba(239,68,68,0.35)' : '#ef4444';
};

const tooltipStatusLabel = (datum: TimelineSeriesDatum): string => {
  if (datum.status === 'STARTED') {
    return 'Активная';
  }
  return datum.net >= 0 ? 'Прибыльная' : 'Убыточная';
};

const formatDuration = (start: number, end: number): string => {
  const ms = Math.max(0, end - start);
  const hours = ms / MS_IN_HOUR;
  if (hours < 24) {
    return `${hours.toFixed(1)} ч`;
  }
  return `${(ms / MS_IN_DAY).toFixed(1)} дн.`;
};

const buildTooltip = (datum: TimelineSeriesDatum): string => {
  const start = dateTimeFormatter.format(new Date(datum.start));
  const end = dateTimeFormatter.format(new Date(datum.end));
  const netDisplay = datum.status === 'STARTED' ? '—' : formatAmount(datum.net, datum.quoteCurrency);
  const limitMarker = datum.limitedByConcurrency ? '<div>Не учтена из-за лимита</div>' : '';
  return [
    `<div><strong>${datum.backtestName}</strong></div>`,
    `<div>${start} — ${end}</div>`,
    `<div>Статус: ${tooltipStatusLabel(datum)}</div>`,
    limitMarker,
    `<div>P&L: ${netDisplay}</div>`,
    `<div>Длительность: ${formatDuration(datum.start, datum.end)}</div>`,
  ]
    .filter(Boolean)
    .join('');
};

type RenderGrid = { x: number; y: number; width: number; height: number };

const clipWithinGrid = (
  params: Parameters<CustomSeriesRenderItem>[0],
  shape: { x: number; y: number; width: number; height: number },
) => {
  const coord = (params.coordSys as unknown as RenderGrid | null) ?? null;
  if (!coord) {
    return shape;
  }
  return echarts.graphic.clipRectByRect(shape, coord) ?? shape;
};

const renderTimelineItem: CustomSeriesRenderItem = (params, api): CustomSeriesRenderItemReturn => {
  const categoryIndex = api.value(0) as number;
  const startCoord = api.coord([api.value(1), categoryIndex]) as [number, number];
  const endCoord = api.coord([api.value(2), categoryIndex]) as [number, number];
  const size = (api.size ? api.size([0, 1]) : [0, 0]) as number[];
  const rawHeight = size[1] ?? ROW_BAR_THICKNESS + ROW_GAP;
  const barHeight = Math.max(1, Math.min(ROW_BAR_THICKNESS, rawHeight - ROW_GAP));
  const width = Math.max(1, (endCoord?.[0] ?? 0) - (startCoord?.[0] ?? 0));
  const rect = clipWithinGrid(params, {
    x: startCoord[0],
    y: startCoord[1] - barHeight / 2,
    width,
    height: barHeight,
  });
  if (!rect) {
    return undefined;
  }
  return {
    type: 'rect',
    shape: rect,
    style: api.style(),
  };
};

type TimelineDatumWithStyle = TimelineSeriesDatum & { itemStyle: { color: string } };

const BacktestDealsTimelineChartComponent = ({ rows }: BacktestDealsTimelineChartProps) => {
  const { mode } = useThemeMode();
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const categories = useMemo(() => rows.map((row) => row.backtestName || `#${row.backtestId}`), [rows]);

  const data = useMemo<TimelineDatumWithStyle[]>(() => {
    return rows.flatMap((row, rowIndex) =>
      row.items.map((item) => {
        const datum: TimelineSeriesDatum = {
          value: [rowIndex, item.start, item.end],
          backtestName: row.backtestName,
          quoteCurrency: row.quoteCurrency,
          status: item.status,
          limitedByConcurrency: item.limitedByConcurrency,
          net: item.net,
          start: item.start,
          end: item.end,
        };
        return {
          ...datum,
          itemStyle: { color: resolveSegmentColor(datum) },
        } satisfies TimelineDatumWithStyle;
      }),
    );
  }, [rows]);

  const option = useMemo<EChartsOption>(() => {
    const axisLabelColor = mode === 'dark' ? '#cbd5e1' : '#475569';
    const axisLineColor = mode === 'dark' ? 'rgba(148, 163, 184, 0.4)' : '#cbd5f5';
    const splitLineColor = mode === 'dark' ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0';
    const tooltipFormatter = (params: unknown): string => {
      const datum = (params as { data?: TimelineSeriesDatum } | undefined)?.data;
      if (!datum) {
        return '';
      }
      return buildTooltip(datum);
    };

    return {
      grid: { left: 16, right: 16, top: 12, bottom: 48 },
      tooltip: {
        trigger: 'item',
        appendToBody: true,
        confine: true,
        borderWidth: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        textStyle: { color: '#f8fafc' },
        formatter: tooltipFormatter,
      },
      xAxis: {
        type: 'time',
        axisLabel: { color: axisLabelColor },
        axisLine: { lineStyle: { color: axisLineColor } },
        splitLine: { show: true, lineStyle: { color: splitLineColor } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none',
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          moveOnMouseMove: false,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          bottom: 8,
          height: 24,
        },
        {
          type: 'inside',
          yAxisIndex: 0,
          filterMode: 'none',
        },
        {
          type: 'slider',
          yAxisIndex: 0,
          filterMode: 'none',
          orient: 'vertical',
          right: 0,
          top: 16,
          bottom: 48,
          width: 10,
        },
      ],
      series: [
        {
          type: 'custom',
          renderItem: renderTimelineItem,
          encode: { x: [1, 2], y: 0 },
          data: data as unknown[],
        },
      ],
    } satisfies EChartsOption;
  }, [categories, data, mode]);

  const maxViewportHeight = viewportHeight > 0 ? Math.round(viewportHeight * 0.8) : 360;
  const autoHeight = rows.length * (ROW_BAR_THICKNESS + ROW_GAP) + 140;
  const chartHeight = Math.max(240, Math.min(maxViewportHeight, autoHeight));

  const chartTheme = mode === 'dark' ? 'dark' : undefined;

  return (
    <ReactECharts
      className="chart__full-width chart--timeline"
      theme={chartTheme}
      option={option}
      notMerge
      opts={{ renderer: 'canvas' }}
      style={{ width: '100%', height: chartHeight }}
    />
  );
};

export const BacktestDealsTimelineChart = memo(BacktestDealsTimelineChartComponent);
