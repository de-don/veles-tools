import { memo, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  createLimitImpactChartOptions,
  type LimitImpactPoint,
} from '../../lib/chartOptions';

interface LimitImpactChartProps {
  points: LimitImpactPoint[];
  className?: string;
}

const LimitImpactChartComponent = ({ points, className }: LimitImpactChartProps) => {
  const option = useMemo(
    () => createLimitImpactChartOptions(points),
    [points],
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

export const LimitImpactChart = memo(LimitImpactChartComponent);
