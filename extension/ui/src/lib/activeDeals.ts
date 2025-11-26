import type { ActiveDeal, ActiveDealAlgorithm, ActiveDealOrder, ActiveDealOrderSide } from '../types/activeDeals';
import { toTimestamp } from './dateTime';
import type { ExecutedOrderPoint } from './deprecatedFile';

const EXECUTED_ORDER_STATUSES = new Set(['EXECUTED', 'FILLED']);
const OPEN_ORDER_STATUSES = new Set(['CREATED', 'PENDING']);

const isExecutedOrder = (order: ActiveDealOrder): boolean => {
  return EXECUTED_ORDER_STATUSES.has(order.status);
};

const isOpenOrder = (order: ActiveDealOrder): boolean => {
  return OPEN_ORDER_STATUSES.has(order.status);
};

const toFiniteNumber = (value: number | null | undefined): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const isAddPositionOrder = (algorithm: ActiveDealAlgorithm, side: ActiveDealOrderSide): boolean => {
  if (algorithm === 'LONG') {
    return side === 'BUY';
  }
  if (algorithm === 'SHORT') {
    return side === 'SELL';
  }
  return false;
};

interface OrderContribution {
  quantity: number;
  cost: number;
}

const accumulateOrderContribution = (order: ActiveDealOrder): OrderContribution | null => {
  if (!EXECUTED_ORDER_STATUSES.has(order.status)) {
    return null;
  }
  const filled = toFiniteNumber(order.filled);
  const price = toFiniteNumber(order.price);
  if (!filled || filled <= 0 || !price || price <= 0) {
    return null;
  }
  const sideMultiplier = order.side === 'SELL' ? -1 : 1;
  const signedQuantity = sideMultiplier * filled;
  const signedCost = signedQuantity * price;
  return { quantity: signedQuantity, cost: signedCost };
};

const computePnlPercent = (pnl: number, exposure: number): number => {
  if (!(Number.isFinite(pnl) && Number.isFinite(exposure)) || exposure === 0) {
    return 0;
  }
  return (pnl / exposure) * 100;
};

const findNearestOpenOrderPrice = (deal: ActiveDeal, referencePrice: number): number | null => {
  if (!Number.isFinite(referencePrice)) {
    return null;
  }
  let nearestPrice: number | null = null;
  let minDistance = Infinity;
  deal.orders.forEach((order) => {
    if (!(isOpenOrder(order) && isAddPositionOrder(deal.algorithm, order.side))) {
      return;
    }
    const price = toFiniteNumber(order.price);
    if (price === null || price <= 0) {
      return;
    }
    const distance = Math.abs(price - referencePrice);
    if (distance < minDistance) {
      minDistance = distance;
      nearestPrice = price;
    }
  });
  return nearestPrice;
};

export interface ActiveDealMetrics {
  deal: ActiveDeal;
  netQuantity: number;
  absQuantity: number;
  averageEntryPrice: number;
  markPrice: number;
  nearestOpenOrderPrice: number | null;
  exposure: number;
  pnl: number;
  pnlPercent: number;
  executedOrdersCount: number;
  totalOrdersCount: number;
}

export interface ActiveDealsAggregation {
  positions: ActiveDealMetrics[];
  totalExposure: number;
  totalPnl: number;
  profitableCount: number;
  losingCount: number;
  flatCount: number;
}

export const computeDealMetrics = (deal: ActiveDeal): ActiveDealMetrics => {
  let executedOrdersCount = 0;
  const totals = deal.orders.reduce(
    (acc, order) => {
      if (isExecutedOrder(order)) {
        executedOrdersCount += 1;
      }
      const contribution = accumulateOrderContribution(order);
      if (!contribution) {
        return acc;
      }
      return {
        quantity: acc.quantity + contribution.quantity,
        cost: acc.cost + contribution.cost,
      };
    },
    { quantity: 0, cost: 0 },
  );

  const fallbackEntry = toFiniteNumber(deal.entryPrice) ?? 0;
  const netQuantity = totals.quantity;
  const absQuantity = Math.abs(netQuantity);
  const averageEntryPrice = absQuantity > 0 ? Math.abs(totals.cost) / absQuantity : fallbackEntry;
  const markPrice = toFiniteNumber(deal.price) ?? averageEntryPrice;
  const nearestOpenOrderPrice = findNearestOpenOrderPrice(deal, markPrice);
  const exposure = absQuantity * averageEntryPrice;
  const pnl = absQuantity > 0 ? markPrice * netQuantity - totals.cost : 0;
  const pnlPercent = computePnlPercent(pnl, exposure);
  const resolvedOrdersSize = toFiniteNumber(deal.ordersSize);
  const normalizedOrdersSize = resolvedOrdersSize !== null ? Math.max(0, Math.trunc(resolvedOrdersSize)) : null;
  const totalOrdersCount = normalizedOrdersSize ?? deal.orders.length;

  return {
    deal,
    netQuantity,
    absQuantity,
    averageEntryPrice,
    markPrice,
    nearestOpenOrderPrice,
    exposure,
    pnl,
    pnlPercent,
    executedOrdersCount,
    totalOrdersCount,
  };
};

export const aggregateDeals = (deals: ActiveDeal[]): ActiveDealsAggregation => {
  const positions = deals.map(computeDealMetrics);

  let totalExposure = 0;
  let totalPnl = 0;
  let profitableCount = 0;
  let losingCount = 0;
  let flatCount = 0;

  positions.forEach((position) => {
    totalExposure += position.exposure;
    totalPnl += position.pnl;
    if (position.pnl > 0) {
      profitableCount += 1;
    } else if (position.pnl < 0) {
      losingCount += 1;
    } else {
      flatCount += 1;
    }
  });

  const sortedPositions = [...positions].sort((a, b) => b.pnl - a.pnl);

  return {
    positions: sortedPositions,
    totalExposure,
    totalPnl,
    profitableCount,
    losingCount,
    flatCount,
  };
};

export const getDealBaseAsset = (deal: ActiveDeal): string => {
  if (deal.pair?.from) {
    return deal.pair.from;
  }
  if (deal.symbol) {
    const [base] = deal.symbol.split(/[/-]/);
    return base?.replace(/USD(T)?$/i, '') ?? deal.symbol;
  }
  return '—';
};

const getDealQuoteAsset = (deal: ActiveDeal): string => {
  if (deal.pair?.to) {
    return deal.pair.to;
  }
  if (deal.symbol) {
    const [, quote] = deal.symbol.split(/[/-]/);
    return quote ?? 'USDT';
  }
  return 'USDT';
};

export interface ExecutedOrdersIndex {
  byDeal: Map<number, ExecutedOrderPoint[]>;
  all: ExecutedOrderPoint[];
}

export const buildExecutedOrdersIndex = (deals: readonly ActiveDeal[]): ExecutedOrdersIndex => {
  const byDeal = new Map<number, ExecutedOrderPoint[]>();
  const all: ExecutedOrderPoint[] = [];

  deals.forEach((deal) => {
    const baseAsset = getDealBaseAsset(deal);
    const quoteAsset = getDealQuoteAsset(deal);
    const pairLabel = quoteAsset ? `${baseAsset}/${quoteAsset}` : baseAsset;

    const executedOrders = deal.orders.filter(
      (order) => isExecutedOrder(order) && isAddPositionOrder(deal.algorithm, order.side),
    );
    executedOrders.sort((left, right) => {
      const leftTimestamp = toTimestamp(left.executedAt);
      const rightTimestamp = toTimestamp(right.executedAt);
      if (leftTimestamp === null || rightTimestamp === null) {
        return 0;
      }
      return leftTimestamp - rightTimestamp;
    });

    executedOrders.forEach((order, index) => {
      const executedAt = toTimestamp(order.executedAt);
      if (executedAt === null) {
        return;
      }
      if (!(Number.isFinite(order.price) && Number.isFinite(order.filled))) {
        return;
      }
      const point: ExecutedOrderPoint = {
        time: executedAt,
        price: order.price,
        quantity: order.filled,
        side: order.side,
        dealId: deal.id,
        pair: pairLabel,
        apiKeyId: deal.apiKeyId,
        botName: deal.botName,
        botId: deal.botId,
        algorithm: deal.algorithm,
        positionVolume: order.position,
        type: index === 0 ? 'ENTRY' : 'DCA',
      };
      const existing = byDeal.get(deal.id) ?? [];
      existing.push(point);
      byDeal.set(deal.id, existing);
      all.push(point);
    });
  });

  byDeal.forEach((orders) => {
    orders.sort((left, right) => left.time - right.time);
  });

  all.sort((left, right) => left.time - right.time);

  return { byDeal, all };
};
