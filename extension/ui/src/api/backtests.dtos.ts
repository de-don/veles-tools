import type {
  BotDepositConfigDto,
  BotProfitConfigDto,
  BotSettingsDto,
  BotStopLossConfigDto,
  StrategyConditionDto,
} from './bots.dtos';

export interface BacktestStatisticsListDto {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestStatisticsDto[];
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
  stopLoss: BotStopLossConfigDto | null;
  settings: BotSettingsDto;
  conditions: StrategyConditionDto[];
  from: string;
  to: string;
  status: string;
  commissions: BacktestCommissionsConfigDto;
  public: boolean;
  useWicks: boolean;
  cursor: string;
}

export interface BacktestStatisticsDto {
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
  duration: number;
  profitBase: number;
  profitQuote: number;
  netBase: number;
  netQuote: number;
  netBasePerDay: number;
  netQuotePerDay: number;
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
  maeAbsolute: number;
  commissionBase: number;
  commissionQuote: number;
}

export interface BacktestCycleDto {
  id: number;
  date: string;
  status: 'CANCELLED' | 'FINISHED' | 'STARTED';
  substatus: 'PULL_UP' | 'TAKE_PROFIT' | string;
  exchange: 'BYBIT_FUTURES' | string;
  symbol: string;
  base: string;
  quote: string;
  profitQuote: number;
  profitBase: number;
  netQuote: number;
  netBase: number | null;
  pnl: number;
  duration: number;
  grid: number;
  executedGrid: number;
  profits: number;
  executedProfits: number;
  volume: number;
  mfePercent: number;
  mfeAbsolute: number;
  maePercent: number;
  maeAbsolute: number;
  commissionBase: number | null;
  commissionQuote: number | null;
  orders: BacktestOrderDto[];
}

export interface BacktestOrderDto {
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
