import type { LimitImpactPoint } from '../lib/chartOptions';
import type { BacktestInfo } from './backtestInfos';

export interface AggregationConfig {
  maxConcurrentPositions: number;
}

export interface ChartPoint {
  date: number;
  value: number;
}

export interface AggregatedBacktestsMetrics {
  totalBacktests: number;
  totalProfitQuote: number;
  averageProfitPerDeal: number;
  averageNetPerDay: number;
  averageWinRatePercent: number | null;
  maxConcurrentPositions: number;
  pnlToRisk: number;
  totalProfitableDeals: number;
  totalLosingDeals: number;
  openDeals: number;
  aggregatedActiveMae: number;
  averageDealDurationDays: number;
  totalIdleDays: number;
  maxAggregatedDrawdown: number;
  maxConcurrentMae: number;
  maeSeries: ChartPoint[];
  pnlSeries: ChartPoint[];
  activeDealCountSeries: ChartPoint[];
  limitImpactPoints?: LimitImpactPoint[];
}

export interface AggregationInput {
  backtests: BacktestInfo[];
  config: AggregationConfig;
}
