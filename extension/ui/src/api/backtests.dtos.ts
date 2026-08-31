import type {
  BotDepositConfigDto,
  BotOrderDto,
  BotProfitConfigDto,
  BotSettingsDto,
  BotStopLossConfigDto,
  ConditionGroupsDto,
  LegacyConditionDto,
} from './bots.dtos';

export interface BacktestStatisticsListDto {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestStatisticsDto[];
}

export interface BacktestLimitsDto {
  expiration: string | number | null;
  /** Remaining backtest period, in days. Replaced the old `permits` run counter. */
  counter: number;
  /** Number of backtests the tariff allows to run in parallel. */
  threads: number;
  tariff: 'FREE' | string;
}

export interface BacktestCyclesListDto {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestCycleDto[];
}

export interface BacktestCommissionsConfigDto {
  maker: number | null;
  taker: number | null;
}

export interface BacktestConfigDto {
  id: number;
  name: string;
  symbol: string;
  exchange: string;
  algorithm: string;
  pullUp: number;
  portion: number;
  profit: BotProfitConfigDto | null;
  deposit: BotDepositConfigDto;
  stopLoss?: BotStopLossConfigDto | null;
  settings: BotSettingsDto;
  // A given backtest uses either the new conditionGroups tree or the legacy flat conditions list — never both.
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
  from: string;
  to: string;
  status: string;
  commissions: BacktestCommissionsConfigDto;
  public: boolean;
  useWicks: boolean;
  /** Simulation accuracy mode, e.g. 'SHADOW'. Added by the 2026 schema change. */
  accuracy?: string | null;
  cursor: string;
}

/**
 * Condensed strategy snapshot the statistics endpoint embeds since the 2026 schema change.
 * Mirrors the bot settings payload, but flattened (deposit/profit/orders on one level).
 */
export interface BacktestStatisticsSettingsDto {
  type: string;
  algorithm: string;
  deposit: BotDepositConfigDto;
  profit: BotProfitConfigDto | null;
  stopLoss?: BotStopLossConfigDto | null;
  portion: number | null;
  pullUp: number | null;
  baseOrder?: BotOrderDto | null;
  indentType?: string | null;
  orders?: BotOrderDto[] | null;
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
}

export interface BacktestStatisticsDto {
  id: number;
  settings?: BacktestStatisticsSettingsDto | null;
  name: string;
  date: string;
  from: string;
  to: string;
  algorithm: string;
  exchange: string;
  symbol: string;
  base: string;
  quote: string;
  duration: number;
  // Since the 2026 schema change profitBase/profitQuote are NET values (commissions already
  // subtracted); the previous netBase/netQuote/netBasePerDay/netQuotePerDay fields are gone.
  profitBase: number;
  profitQuote: number;
  basePerDay: number;
  quotePerDay: number;
  minProfitBase: number;
  maxProfitBase: number;
  avgProfitBase: number;
  minProfitQuote: number;
  maxProfitQuote: number;
  avgProfitQuote: number;
  volume: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  profits: number;
  losses: number;
  breakevens: number;
  pullUps: number;
  winRateProfits: number;
  winRateLosses: number;
  totalDeals: number;
  minGrid: number;
  maxGrid: number;
  avgGrid: number;
  minProfit: number;
  maxProfit: number;
  avgProfit: number;
  mfePercent: number;
  mfeAbsolute: number;
  maePercent: number;
  maeAbsolute: number; // Negative value
  maeDepositPercent?: number | null;
  mfeDepositPercent?: number | null;
  commissionBase: number | null;
  commissionQuote: number | null;
  roi?: number | null;
  profitFactor?: number | null;
  recoveryFactor?: number | null;
  expectedMaxLossStreak?: number | null;
  maxLossStreak?: number | null;
  worstStreakReserve?: number | null;
  cagr?: number | null;
  timeInDealsPercent?: number | null;
  // Metrics of the deal that is still open at the end of the backtest period (null when none).
  activeMaePercent?: number | null;
  activeMaeAbsolute?: number | null;
  activeDuration?: number | null;
}

/** Shape of the statistics payload before the 2026 schema change; still present in cached records. */
export interface LegacyBacktestStatisticsDto {
  netBase?: number;
  netQuote?: number;
  netBasePerDay?: number;
  netQuotePerDay?: number;
}

export interface BacktestCycleDto {
  backtestId?: number;
  date: string;
  /** Cycle open time. Reliable even when the cycle carries no orders. */
  createdAt?: string | null;
  status: 'CANCELLED' | 'FINISHED' | 'STARTED';
  substatus: 'PULL_UP' | 'TAKE_PROFIT' | string;
  exchange: 'BYBIT_FUTURES' | string;
  symbol: string;
  base: string;
  quote: string;
  profitQuote: number | null; // null for cancelled
  profitBase: number | null; // null for cancelled
  netQuote: number | null; // null for cancelled
  netBase: number | null;
  pnl: number | null; // null for cancelled
  duration: number | null; // null for cancelled
  grid: number;
  executedGrid: number;
  profits: number;
  executedProfits: number;
  volume: number;
  mfePercent: number;
  mfeAbsolute: number;
  maePercent: number;
  maeAbsolute: number;
  commissionBase: number | null; // null for cancelled
  commissionQuote: number | null; // null for cancelled
  orders: BacktestOrderDto[];
}

export interface BacktestOrderDto {
  category: 'GRID' | 'PROFIT' | 'STOP_LOSS' | string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | string;
  position: number;
  quantity: number;
  price: number;
  status: 'EXECUTED' | 'CANCELLED' | 'NEW' | string;
  createdAt: string;
  executedAt: string | null;
  commissionAmount: number | null;
  commissionAsset: string | null;
}
