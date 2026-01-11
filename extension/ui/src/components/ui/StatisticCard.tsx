import type { StatisticProps } from 'antd';
import { Space, Statistic, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

type StatisticTrend = 'default' | 'positive' | 'negative' | 'neutral' | 'muted';

const trendValueStyles: Record<StatisticTrend, CSSProperties> = {
  default: {},
  positive: { color: 'var(--veles-color-positive, #047857)' },
  negative: { color: 'var(--veles-color-negative, #b91c1c)' },
  neutral: { color: 'var(--ant-color-text, #0f172a)' },
  muted: { color: 'var(--ant-color-text, #0f172a)' },
};

export interface StatisticCardProps extends Omit<StatisticProps, 'title'> {
  title: ReactNode;
  tooltip?: ReactNode;
  description?: ReactNode;
  trend?: StatisticTrend;
  className?: string;
}

export const StatisticCard = ({
  title,
  tooltip,
  description,
  trend = 'default',
  className,
  valueStyle,
  ...statisticProps
}: StatisticCardProps) => {
  const containerClassName = className ? `statistic-card ${className}` : 'statistic-card';
  const titleNode = tooltip ? (
    <Space size={4} align="center">
      <span>{title}</span>
      {tooltip}
    </Space>
  ) : (
    title
  );

  const mergedValueStyle: CSSProperties = {
    ...trendValueStyles[trend],
    ...valueStyle,
  };

  return (
    <div className={containerClassName}>
      <Statistic title={titleNode} valueStyle={mergedValueStyle} {...statisticProps} />
      {description ? (
        <Typography.Text type="secondary" className="statistic-card__description">
          {description}
        </Typography.Text>
      ) : null}
    </div>
  );
};

export default StatisticCard;
