import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import type { PortfolioEquitySeries } from '../../lib/backtestAggregation';
import { createPortfolioEquityChartOptions, type DataZoomRange } from '../../lib/chartOptions';

interface PortfolioEquityChartProps {
  series: PortfolioEquitySeries;
  className?: string;
  dataZoomRange?: DataZoomRange;
  onDataZoom?: (range: DataZoomRange) => void;
}

interface DataZoomEventParams {
  start?: number;
  end?: number;
  batch?: Array<{ start?: number; end?: number }>;
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

const PortfolioEquityChartComponent = ({ series, className, dataZoomRange, onDataZoom }: PortfolioEquityChartProps) => {
  const option = useMemo(() => createPortfolioEquityChartOptions(series, dataZoomRange), [series, dataZoomRange]);

  const onEvents = useMemo(() => {
    if (!onDataZoom) {
      return undefined;
    }
    return {
      datazoom: (event: DataZoomEventParams) => {
        const range = extractRangeFromEvent(event);
        if (typeof range.start === 'number' || typeof range.end === 'number') {
          onDataZoom(range);
        }
      },
    } satisfies Record<string, (event: DataZoomEventParams) => void>;
  }, [onDataZoom]);

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
