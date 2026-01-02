import ReactECharts from 'echarts-for-react';
import { memo, useMemo } from 'react';
import { useThemeMode } from '../../context/ThemeContext';
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
  const { mode } = useThemeMode();
  const option = useMemo(() => createLimitImpactChartOptions(points, mode), [points, mode]);
  const resolvedClassName = ['chart__full-width', className].filter(Boolean).join(' ');
  const chartTheme = mode === 'dark' ? 'dark' : undefined;

  return (
    <ReactECharts
      className={resolvedClassName}
      theme={chartTheme}
      opts={{ renderer: 'canvas' }}
      notMerge
      option={option}
    />
  );
};

export const LimitImpactChart = memo(LimitImpactChartComponent);

const LimitRiskEfficiencyChartComponent = ({ points, className }: LimitImpactChartProps) => {
  const { mode } = useThemeMode();
  const option = useMemo(() => createLimitEfficiencyChartOptions(points, mode), [points, mode]);
  const resolvedClassName = ['chart__full-width', className].filter(Boolean).join(' ');
  const chartTheme = mode === 'dark' ? 'dark' : undefined;

  return (
    <ReactECharts
      className={resolvedClassName}
      theme={chartTheme}
      opts={{ renderer: 'canvas' }}
      notMerge
      option={option}
    />
  );
};

export const LimitRiskEfficiencyChart = memo(LimitRiskEfficiencyChartComponent);
