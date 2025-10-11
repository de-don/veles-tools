import type { ActiveDeal, ActiveDealOrder } from '../types/activeDeals';

const EXECUTED_ORDER_STATUSES = new Set(['EXECUTED', 'FILLED']);

const isExecutedOrder = (order: ActiveDealOrder): boolean => {
  return EXECUTED_ORDER_STATUSES.has(order.status);
};

const toFiniteNumber = (value: number | null | undefined): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

interface OrderContribution {
  quantity: number;
  cost: number;
}

const accumulateOrderContribution = (
  order: ActiveDealOrder,
): OrderContribution | null => {
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
  if (!Number.isFinite(pnl) || !Number.isFinite(exposure) || exposure === 0) {
    return 0;
  }
  return (pnl / exposure) * 100;
};

export interface ActiveDealMetrics {
  deal: ActiveDeal;
  netQuantity: number;
  absQuantity: number;
  averageEntryPrice: number;
  markPrice: number;
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
  const exposure = absQuantity * averageEntryPrice;
  const pnl = absQuantity > 0 ? markPrice * netQuantity - totals.cost : 0;
  const pnlPercent = computePnlPercent(pnl, exposure);
  const totalOrdersCount = deal.orders.length;

  return {
    deal,
    netQuantity,
    absQuantity,
    averageEntryPrice,
    markPrice,
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
