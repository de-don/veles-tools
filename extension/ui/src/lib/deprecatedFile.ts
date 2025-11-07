export interface TimeInterval {
  start: number;
  end: number;
}

export interface RiskInterval extends TimeInterval {
  value: number;
}

export interface EquityEvent {
  time: number;
  delta: number;
  cumulative: number;
  drawdown: number;
}

export interface AggregationTrade {
  id: number;
  backtestId: number;
  start: number;
  end: number;
  net: number;
  mfe: number;
  mae: number;
}

export interface BacktestAggregationMetrics {
  id: number;
  name: string;
  symbol: string;
  depositAmount: number | null;
  depositCurrency: string | null;
  depositLeverage: number | null;
  winRatePercent: number | null;
  pnl: number;
  profitsCount: number;
  lossesCount: number;
  totalDeals: number;
  avgTradeDurationDays: number;
  totalTradeDurationSec: number;
  avgNetPerDay: number;
  maxDrawdown: number;
  maxMPU: number;
  maxMPP: number;
  worstRisk: number;
  riskEfficiency: number | null;
  downtimeDays: number;
  activeMpu: number;
  openPosition: OpenPositionRisk | null;
  spanStart: number | null;
  spanEnd: number | null;
  activeDurationMs: number;
  equityEvents: EquityEvent[];
  concurrencyIntervals: TimeInterval[];
  riskIntervals: RiskInterval[];
  activeDayIndices: number[];
  trades: AggregationTrade[];
}

export interface DailyConcurrencyRecord {
  dayIndex: number;
  dayStartMs: number;
  activeDurationMs: number;
  maxCount: number;
  avgActiveCount: number;
}

export interface PortfolioEquityPoint {
  time: number;
  value: number;
}

export interface PortfolioEquitySeries {
  points: PortfolioEquityPoint[];
  minValue: number;
  maxValue: number;
}

export interface PortfolioEquityGroupedSeriesItem {
  id: string;
  label: string;
  series: PortfolioEquitySeries;
  apiKeyId?: number;
}

export interface AggregateRiskPoint {
  time: number;
  value: number;
}

export interface AggregateRiskSeries {
  points: AggregateRiskPoint[];
  maxValue: number;
}

export interface DailyConcurrencyStats {
  meanMax: number;
  p75: number;
  p90: number;
  p95: number;
  limits: {
    p75: number;
    p90: number;
    p95: number;
  };
}

export interface DailyConcurrencyResult {
  records: DailyConcurrencyRecord[];
  stats: DailyConcurrencyStats;
}

export interface AggregationSummary {
  totalSelected: number;
  totalPnl: number;
  totalProfits: number;
  totalLosses: number;
  totalDeals: number;
  openDeals: number;
  activeMpu: number;
  avgPnlPerDeal: number;
  avgPnlPerBacktest: number;
  avgNetPerDay: number;
  avgTradeDurationDays: number;
  avgMaxDrawdown: number;
  aggregateDrawdown: number;
  aggregateMPU: number;
  aggregateWorstRisk: number;
  aggregateRiskEfficiency: number | null;
  maxConcurrent: number;
  avgConcurrent: number;
  noTradeDays: number;
  dailyConcurrency: DailyConcurrencyResult;
  portfolioEquity: PortfolioEquitySeries;
  aggregateRiskSeries: AggregateRiskSeries;
}

interface OpenPositionRisk {
  cycleId: number;
  mpu: number;
  start: number | null;
  lastUpdate: number | null;
}
