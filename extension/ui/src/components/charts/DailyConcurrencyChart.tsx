import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { useThemeMode } from '../../context/ThemeContext';
import type { DailyConcurrencyRecord, DailyConcurrencyStats } from '../../lib/aggregationTypes';
import { createDailyConcurrencyChartOptions, type DataZoomRange } from '../../lib/chartOptions';

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
  const { mode } = useThemeMode();
  const option = useMemo(
    () =>
      createDailyConcurrencyChartOptions(records, stats, dataZoomRange, filterVisibleRange ? 'filter' : 'none', mode),
    [records, stats, dataZoomRange, filterVisibleRange, mode],
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

export const DailyConcurrencyChart = memo(DailyConcurrencyChartComponent);
