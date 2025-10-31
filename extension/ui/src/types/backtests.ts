import type { BotStopLossConfig, StrategyCondition } from './bots';

export interface BacktestStatisticsListResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestStatistics[];
}

export interface BacktestDepositConfig {
  amount: number | string | null;
  leverage: number | string | null;
  marginType: string | null;
  currency?: string | null;
}

export interface BacktestCommissionsConfig {
  maker: number | null;
  taker: number | null;
}

type BacktestJsonPrimitive = string | number | boolean | null;

export type BacktestJsonValue =
  | BacktestJsonPrimitive
  | BacktestJsonValue[]
  | { [key: string]: BacktestJsonValue | undefined };

export type BacktestSettings = Record<string, BacktestJsonValue | undefined> | null;

export interface BacktestProfitConfig {
  type: string;
  currency: string;
  checkPnl: number | null;
  conditions: StrategyCondition[] | null;
}

export interface BacktestConfig {
  id: number;
  name: string;
  symbol: string | null;
  exchange: string | null;
  algorithm: string | null;
  pullUp: number | null;
  portion: number | null;
  profit: BacktestProfitConfig | null;
  deposit: BacktestDepositConfig | null;
  stopLoss: BotStopLossConfig | null;
  settings: BacktestSettings;
  conditions: StrategyCondition[] | null;
  from: string | null;
  to: string | null;
  status: string | null;
  commissions: BacktestCommissionsConfig | null;
  public: boolean | null;
  useWicks: boolean | null;
  cursor: string | null;
  includePosition: boolean | null;
  symbols: string[] | null;
}

export interface BacktestStatistics {
  id: number;
  name: string;
  date: string;
  from: string;
  to: string;
  algorithm: string;
  exchange: string;
  symbol: string;
  base: string;
  quote: string;
  duration: number | null;
  profitBase: number | null;
  profitQuote: number | null;
  netBase: number | null;
  netQuote: number | null;
  netBasePerDay: number | null;
  netQuotePerDay: number | null;
  minProfitBase: number | null;
  maxProfitBase: number | null;
  avgProfitBase: number | null;
  minProfitQuote: number | null;
  maxProfitQuote: number | null;
  avgProfitQuote: number | null;
  volume: number | null;
  minDuration: number | null;
  maxDuration: number | null;
  avgDuration: number | null;
  profits: number | null;
  losses: number | null;
  breakevens: number | null;
  pullUps: number | null;
  winRateProfits: number | null;
  winRateLosses: number | null;
  totalDeals: number | null;
  minGrid: number | null;
  maxGrid: number | null;
  avgGrid: number | null;
  minProfit: number | null;
  maxProfit: number | null;
  avgProfit: number | null;
  mfePercent: number | null;
  mfeAbsolute: number | null;
  maePercent: number | null;
  maeAbsolute: number | null;
  commissionBase: number | null;
  commissionQuote: number | null;
  deposit?: BacktestDepositConfig | null;
}

export interface BacktestsListParams {
  page: number;
  size: number;
  sort?: string;
}

export interface BacktestStatisticsDetail extends BacktestStatistics {
  pullUp?: number | null;
  portion?: number | null;
  profit?: BacktestProfitConfig | null;
  deposit?: BacktestDepositConfig | null;
  stopLoss?: BotStopLossConfig | null;
  settings?: BacktestSettings;
  conditions?: StrategyCondition[] | null;
  commissions?: BacktestCommissionsConfig | null;
  public?: boolean | null;
  useWicks?: boolean | null;
  cursor?: string | null;
  includePosition?: boolean | null;
  symbols?: string[] | null;
  status?: string | null;
  start?: string | null;
  end?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  range?: {
    from?: string | null;
    to?: string | null;
  } | null;
  period?: {
    from?: string | null;
    to?: string | null;
    start?: string | null;
    end?: string | null;
  } | null;
}

export interface BacktestOrder {
  category: 'GRID';
  side: 'BUY' | 'SELL';
  type: 'MARKET';
  position: number;
  quantity: number;
  price: number;
  status: 'EXECUTED';
  createdAt: string;
  executedAt: string;
  commissionAmount: number;
  commissionAsset: string;
}

export interface BacktestCycle {
  id: number;
  status: 'CANCELLED' | 'FINISHED' | 'STARTED';
  substatus?: 'PULL_UP' | 'TAKE_PROFIT' | string | null;
  exchange?: 'BYBIT_FUTURES' | string | null;
  symbol?: string | null;
  base?: string | null;
  quote?: string | null;
  /** Completion date of the cycle */
  date: string;
  duration?: number | null;
  netQuote?: number | null;
  netBase?: number | null;
  profitQuote?: number | null;
  profitBase?: number | null;
  pnl?: number | null;
  mfeAbsolute?: number | null;
  maeAbsolute?: number | null;
  mfePercent?: number | null;
  maePercent?: number | null;
  grid?: number | null;
  executedGrid?: number | null;
  profits?: number | null;
  executedProfits?: number | null;
  volume?: number | null;
  commissionBase?: number | null;
  commissionQuote?: number | null;
  orders?: BacktestOrder[] | null;
}

export interface PaginatedResponse<TItem> {
  content: TItem[];
  totalPages: number;
  totalElements?: number;
  pageNumber?: number;
}
