import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { createDailyConcurrencyChartOptions, type DataZoomRange } from '../../lib/chartOptions';
import type { DailyConcurrencyRecord, DailyConcurrencyStats } from '../../lib/deprecatedFile';

interface DailyConcurrencyChartProps {
  records: DailyConcurrencyRecord[];
  stats?: DailyConcurrencyStats;
  className?: string;
  filterVisibleRange?: boolean;
  dataZoomRange?: DataZoomRange;
  onDataZoom?: (range: DataZoomRange) => void;
}

interface DataZoomEventParams {
  start?: number;
  end?: number;
  startValue?: number;
  endValue?: number;
  batch?: Array<{ start?: number; end?: number; startValue?: number; endValue?: number }>;
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
    startValue: typeof payload.startValue === 'number' ? payload.startValue : undefined,
    endValue: typeof payload.endValue === 'number' ? payload.endValue : undefined,
  };
};

const DailyConcurrencyChartComponent = ({
  records,
  stats,
  className,
  filterVisibleRange = false,
  dataZoomRange,
  onDataZoom,
}: DailyConcurrencyChartProps) => {
  const option = useMemo(
    () => createDailyConcurrencyChartOptions(records, stats, dataZoomRange, filterVisibleRange ? 'filter' : 'none'),
    [records, stats, dataZoomRange, filterVisibleRange],
  );

  const onEvents = useMemo(() => {
    if (!onDataZoom) {
      return undefined;
    }
    return {
      datazoom: (event: DataZoomEventParams) => {
        const range = extractRangeFromEvent(event);
        if (
          typeof range.start === 'number' ||
          typeof range.end === 'number' ||
          typeof range.startValue === 'number' ||
          typeof range.endValue === 'number'
        ) {
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

export const DailyConcurrencyChart = memo(DailyConcurrencyChartComponent);
