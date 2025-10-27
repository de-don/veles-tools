import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import {
  createLimitEfficiencyChartOptions,
  createLimitImpactChartOptions,
  type LimitImpactPoint,
} from '../../lib/chartOptions';

interface LimitImpactChartProps {
  points: LimitImpactPoint[];
  className?: string;
}

const LimitImpactChartComponent = ({ points, className }: LimitImpactChartProps) => {
  const option = useMemo(() => createLimitImpactChartOptions(points), [points]);

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

const LimitRiskEfficiencyChartComponent = ({ points, className }: LimitImpactChartProps) => {
  const option = useMemo(() => createLimitEfficiencyChartOptions(points), [points]);

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

export const LimitRiskEfficiencyChart = memo(LimitRiskEfficiencyChartComponent);
