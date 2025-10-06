import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { DailyConcurrencyRecord, DailyConcurrencyStats } from '../../lib/backtestAggregation';
import { createDailyConcurrencyChartOptions } from '../../lib/chartOptions';

interface DailyConcurrencyChartProps {
  records: DailyConcurrencyRecord[];
  stats?: DailyConcurrencyStats;
  className?: string;
}

const DailyConcurrencyChartComponent = ({ records, stats, className }: DailyConcurrencyChartProps) => {
  const option = useMemo(
    () => createDailyConcurrencyChartOptions(records, stats),
    [records, stats],
  );

  return (
    <ReactECharts
      className={className}
      style={{ width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      option={option}
    />
  );
};

export const DailyConcurrencyChart = memo(DailyConcurrencyChartComponent);
