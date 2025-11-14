import type { LimitImpactPoint } from '../lib/chartOptions';
import type { BacktestInfo, BacktestInfoDeal } from './backtestInfos';

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
  dealTimelineRows: DealTimelineRow[];
  limitImpactPoints?: LimitImpactPoint[];
}

export interface DealTimelineItem {
  id: string;
  start: number;
  end: number;
  net: number;
  status: BacktestInfoDeal['status'];
  limitedByConcurrency: boolean;
}

export interface DealTimelineRow {
  backtestId: number;
  backtestName: string;
  quoteCurrency: string;
  items: DealTimelineItem[];
}

export interface AggregationInput {
  backtests: BacktestInfo[];
  config: AggregationConfig;
}
