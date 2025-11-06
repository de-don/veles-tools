import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import type { PortfolioEquityGroupedSeriesItem, PortfolioEquitySeries } from '../../lib/backtestAggregation';
import { createPortfolioEquityChartOptions, type DataZoomRange } from '../../lib/chartOptions';

interface PortfolioEquityChartProps {
  series: PortfolioEquitySeries;
  className?: string;
  dataZoomRange?: DataZoomRange;
  onDataZoom?: (range: DataZoomRange) => void;
  groupedSeries?: PortfolioEquityGroupedSeriesItem[];
  legendSelection?: Record<string, boolean>;
  onLegendSelectionChange?: (selection: Record<string, boolean>) => void;
}

interface DataZoomEventParams {
  start?: number;
  end?: number;
  batch?: Array<{ start?: number; end?: number }>;
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
  return {
    start: clampRangeValue(payload.start),
    end: clampRangeValue(payload.end),
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
}: PortfolioEquityChartProps) => {
  const option = useMemo(
    () => createPortfolioEquityChartOptions(series, dataZoomRange, groupedSeries, legendSelection),
    [series, dataZoomRange, groupedSeries, legendSelection],
  );

  const onEvents = useMemo(() => {
    if (!onDataZoom && !onLegendSelectionChange) {
      return undefined;
    }
    const handlers: Record<string, (event: unknown) => void> = {};
    if (onDataZoom) {
      handlers.datazoom = (event: unknown) => {
        const range = extractRangeFromEvent(event as DataZoomEventParams);
        if (typeof range.start === 'number' || typeof range.end === 'number') {
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

  return (
    <ReactECharts
      className={className}
      style={{ width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      option={option}
      onEvents={onEvents}
    />
  );
};

export const PortfolioEquityChart = memo(PortfolioEquityChartComponent);
