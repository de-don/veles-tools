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
  const resolvedClassName = ['chart__full-width', className].filter(Boolean).join(' ');

  return <ReactECharts className={resolvedClassName} opts={{ renderer: 'canvas' }} notMerge option={option} />;
};

export const LimitImpactChart = memo(LimitImpactChartComponent);

const LimitRiskEfficiencyChartComponent = ({ points, className }: LimitImpactChartProps) => {
  const option = useMemo(() => createLimitEfficiencyChartOptions(points), [points]);
  const resolvedClassName = ['chart__full-width', className].filter(Boolean).join(' ');

  return <ReactECharts className={resolvedClassName} opts={{ renderer: 'canvas' }} notMerge option={option} />;
};

export const LimitRiskEfficiencyChart = memo(LimitRiskEfficiencyChartComponent);
