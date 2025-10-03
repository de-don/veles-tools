export interface BotsListParams {
  page: number;
  size: number;
  sort?: string;
}

export interface BotsListResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: TradingBot[];
}

export interface TradingBot {
  id: number;
  name: string;
  exchange: string;
  algorithm: string;
  pullUp: number | null;
  portion: number | null;
  profit: BotProfitConfig | null;
  deposit: BotDepositConfig | null;
  stopLoss: BotStopLossConfig | null;
  settings: BotSettings | null;
  conditions: StrategyCondition[] | null;
  status: BotStatus;
  apiKey: number | null;
  substatus: string | null;
  symbols: string[];
}

export interface BotSummary {
  id: number;
  name: string;
  exchange: string;
  algorithm: string;
  status: BotStatus;
  substatus: string | null;
}

export interface BotProfitConfig {
  type: string;
  currency: string;
  checkPnl: number | null;
  conditions: StrategyCondition[] | null;
}

export interface BotDepositConfig {
  amount: number | null;
  leverage: number | null;
  marginType: string | null;
}

export interface BotStopLossConfig {
  indent: number | null;
  termination: boolean | null;
  conditionalIndent: number | null;
  conditions: StrategyCondition[] | null;
  conditionalIndentType: string | null;
}

export interface BotSettings {
  type: string;
  baseOrder: BotOrder | null;
  orders: BotOrder[] | null;
  indentType: string | null;
  includePosition: boolean | null;
}

export interface BotOrder {
  indent: number | null;
  volume: number | null;
  conditions: StrategyCondition[] | null;
}

export interface StrategyCondition {
  type: string;
  indicator: string | null;
  interval: string | null;
  basic: boolean | null;
  value: number | null;
  operation: string | null;
  closed: boolean | null;
  reverse: boolean | null;
}

export type BotStatus =
  | 'STARTED'
  | 'STOPPED'
  | 'PAUSED'
  | 'AWAITING_SIGNAL'
  | 'AWAITING_ORDER'
  | 'AWAITING_RESULTS'
  | 'DRAFT'
  | string;
