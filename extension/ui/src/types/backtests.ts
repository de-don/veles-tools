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
  category?: string | null;
  side?: string | null;
  type?: string | null;
  position?: number | null;
  quantity?: number | null;
  price?: number | null;
  status?: string | null;
  createdAt?: string | null;
  executedAt?: string | null;
  updatedAt?: string | null;
  commissionAmount?: number | null;
  commissionAsset?: string | null;
}

export interface BacktestCycle {
  id: number;
  status: 'CANCELED' | 'FINISHED' | string;
  substatus?: 'PULL_UP' | 'TAKE_PROFIT' | string | null;
  exchange?: 'BYBIT_FUTURES' | string | null;
  symbol?: string | null;
  base?: string | null;
  quote?: string | null;
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
