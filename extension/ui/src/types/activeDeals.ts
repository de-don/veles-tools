export type ActiveDealStatus = 'STARTED' | 'COMPLETED' | 'TERMINATED' | 'STOPPED' | 'FAILED' | 'PAUSED' | 'PENDING';

export type ActiveDealAlgorithm = 'LONG' | 'SHORT';

export type ActiveDealOrderType =
  | 'MARKET'
  | 'LIMIT'
  | 'STOP'
  | 'STOP_MARKET'
  | 'TAKE_PROFIT'
  | 'TRAILING_STOP'
  | 'UNKNOWN';

export type ActiveDealOrderSide = 'BUY' | 'SELL';

export type ActiveDealOrderStatus = 'CREATED' | 'EXECUTED' | 'FILLED' | 'PENDING' | 'CANCELLED' | 'FAILED';

export interface ActiveDealPair {
  exchange: string;
  type: string;
  symbol: string;
  from: string;
  to: string;
}

export interface ActiveDealOrder {
  id: number;
  category: string;
  type: ActiveDealOrderType;
  side: ActiveDealOrderSide;
  position: number;
  quantity: number;
  filled: number;
  price: number;
  status: ActiveDealOrderStatus;
  publishedAt: string | null;
  executedAt: string | null;
}

export interface ActiveDealStopLoss {
  indent: number;
  termination: boolean;
  conditionalIndent: number | null;
  conditions: string | null;
  conditionalIndentType: string | null;
}

export interface ActiveDealTermination {
  reason?: string | null;
  triggeredAt?: string | null;
  price?: number | null;
  profit?: number | null;
}

export interface ActiveDeal {
  id: number;
  status: ActiveDealStatus;
  createdAt: string;
  apiKeyId: number;
  botId: number;
  botName: string;
  algorithm: ActiveDealAlgorithm;
  pullUp: number | null;
  entryPrice: number;
  pair: ActiveDealPair;
  orders: ActiveDealOrder[];
  profits: number | null;
  price: number | null;
  termination: ActiveDealTermination | null;
  dealsLeft: number | null;
  ordersSize: number;
  stopLoss: ActiveDealStopLoss | null;
  exchange: string;
  symbol: string;
}

export interface ActiveDealsResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: ActiveDeal[];
}

export interface ActiveDealsQueryParams {
  page?: number;
  size?: number;
  exchange?: 'BINANCE_FUTURES' | string;
}
