import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { useThemeMode } from '../../context/ThemeContext';
import type {
  ExecutedOrderPoint,
  PortfolioEquityGroupedSeriesItem,
  PortfolioEquitySeries,
} from '../../lib/aggregationTypes';
import { createPortfolioEquityChartOptions, type DataZoomRange } from '../../lib/chartOptions';

interface PortfolioEquityChartProps {
  series: PortfolioEquitySeries;
  className?: string;
  dataZoomRange?: DataZoomRange;
  onDataZoom?: (range: DataZoomRange) => void;
  groupedSeries?: PortfolioEquityGroupedSeriesItem[];
  legendSelection?: Record<string, boolean>;
  onLegendSelectionChange?: (selection: Record<string, boolean>) => void;
  filterVisibleRange?: boolean;
  executedOrders?: ExecutedOrderPoint[];
  hideLegend?: boolean;
}

interface DataZoomEventParams {
  start?: number;
  end?: number;
  startValue?: number;
  endValue?: number;
  batch?: Array<{ start?: number; end?: number; startValue?: number; endValue?: number }>;
}

interface LegendSelectionEventParams {
  selected: Record<string, boolean>;
}

const clampRangeValue = (value?: number): number | undefined => {
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

const extractRangeFromEvent = (event: DataZoomEventParams): DataZoomRange => {
  const payload = event.batch && event.batch.length > 0 ? event.batch[0] : event;
  const start = clampRangeValue(payload.start);
  const end = clampRangeValue(payload.end);
  return {
    start,
    end,
    startValue: typeof payload.startValue === 'number' ? payload.startValue : undefined,
    endValue: typeof payload.endValue === 'number' ? payload.endValue : undefined,
  };
};

const PortfolioEquityChartComponent = ({
  series,
  className,
  dataZoomRange,
  onDataZoom,
  groupedSeries,
  legendSelection,
  onLegendSelectionChange,
  filterVisibleRange = false,
  executedOrders,
  hideLegend = false,
}: PortfolioEquityChartProps) => {
  const { mode } = useThemeMode();
  const option = useMemo(
    () =>
      createPortfolioEquityChartOptions(
        series,
        dataZoomRange,
        groupedSeries,
        executedOrders,
        legendSelection,
        filterVisibleRange ? 'filter' : 'none',
        mode,
        hideLegend,
      ),
    [series, dataZoomRange, groupedSeries, executedOrders, legendSelection, filterVisibleRange, mode, hideLegend],
  );

  const onEvents = useMemo(() => {
    if (!(onDataZoom || onLegendSelectionChange)) {
      return undefined;
    }
    const handlers: Record<string, (event: unknown) => void> = {};
    if (onDataZoom) {
      handlers.datazoom = (event: unknown) => {
        const range = extractRangeFromEvent(event as DataZoomEventParams);
        if (
          typeof range.start === 'number' ||
          typeof range.end === 'number' ||
          typeof range.startValue === 'number' ||
          typeof range.endValue === 'number'
        ) {
          onDataZoom(range);
        }
      };
    }
    if (onLegendSelectionChange) {
      const handleLegend = (event: unknown) => {
        const payload = event as LegendSelectionEventParams;
        onLegendSelectionChange(payload.selected);
      };
      handlers.legendselectchanged = handleLegend;
      handlers.legendunselect = handleLegend;
      handlers.legendselectall = handleLegend;
    }
    return handlers;
  }, [onDataZoom, onLegendSelectionChange]);

  const resolvedClassName = ['chart__full-width', className].filter(Boolean).join(' ');
  const chartTheme = mode === 'dark' ? 'dark' : undefined;

  return (
    <ReactECharts
      className={resolvedClassName}
      theme={chartTheme}
      opts={{ renderer: 'canvas' }}
      notMerge
      option={option}
      onEvents={onEvents}
    />
  );
};

export const PortfolioEquityChart = memo(PortfolioEquityChartComponent);
