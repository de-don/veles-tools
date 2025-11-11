import type { BacktestCycle } from './backtests';

export interface BacktestInfoDeal {
  id: number;
  start: number;
  end: number;
  startDay: Date; // day of start (00:00:00)
  endDay: Date; // day of end (00:00:00)
  status: BacktestCycle['status'];
  net: number;
  maeAbsolute: number; // maximum adverse excursion in absolute quote currency
  mfeAbsolute: number; // maximum favorable excursion in absolute quote currency
  durationInDays: number; // calculated duration in days (decimal)
}

export interface BacktestInfo {
  id: number;
  name: string;
  exchange: string;
  symbol: string;
  algorithm: string;
  base: string;
  quote: string;
  from: string;
  to: string;
  depositAmount: number;
  depositCurrency: string;
  leverage: number;
  winRatePercent: number | null; // Null if no deals
  profitableDeals: number;
  losingDeals: number;
  profitNet: number;
  netQuotePerDay: number;
  activeMaeAbsolute: number | null;
  averageDurationDays: number;
  tradingDays: number;
  maxMaeAbsolute: number;
  maxMfeAbsolute: number;
  avgMaeAbsolute: number;
  avgMfeAbsolute: number;
  /** Maximum drawdown in quote currency */
  maxDrawdownQuote: number;
  deals: BacktestInfoDeal[];
}
