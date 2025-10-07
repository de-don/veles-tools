import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { PortfolioEquitySeries } from '../../lib/backtestAggregation';
import { createPortfolioEquityChartOptions } from '../../lib/chartOptions';

interface PortfolioEquityChartProps {
  series: PortfolioEquitySeries;
  className?: string;
}

const PortfolioEquityChartComponent = ({ series, className }: PortfolioEquityChartProps) => {
  const option = useMemo(() => createPortfolioEquityChartOptions(series), [series]);

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

export const PortfolioEquityChart = memo(PortfolioEquityChartComponent);
