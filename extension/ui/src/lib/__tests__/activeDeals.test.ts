import { describe, expect, it } from 'vitest';
import { aggregateDeals, computeDealMetrics } from '../activeDeals';
import type { ActiveDeal } from '../../types/activeDeals';

const createDeal = (overrides: Partial<ActiveDeal>): ActiveDeal => ({
  id: 1,
  status: 'STARTED',
  createdAt: '2025-10-07T00:00:00.000Z',
  apiKeyId: 1,
  botId: 1,
  botName: 'Test Bot',
  algorithm: 'LONG',
  pullUp: null,
  entryPrice: 100,
  pair: {
    exchange: 'BINANCE_FUTURES',
    type: 'FUTURES',
    symbol: 'TESTUSDT',
    from: 'TEST',
    to: 'USDT',
  },
  orders: [
    {
      id: 1,
      category: 'GRID',
      type: 'MARKET',
      side: 'BUY',
      position: 1,
      quantity: 1,
      filled: 1,
      price: 100,
      status: 'EXECUTED',
      publishedAt: '2025-10-07T00:00:00.000Z',
      executedAt: '2025-10-07T00:00:00.000Z',
    },
  ],
  profits: null,
  price: 110,
  termination: null,
  dealsLeft: null,
  ordersSize: 1,
  stopLoss: null,
  exchange: 'BINANCE_FUTURES',
  symbol: 'TEST/USDT',
  ...overrides,
});

describe('activeDeals metrics', () => {
  it('computes metrics for a long position', () => {
    const deal = createDeal({});
    const metrics = computeDealMetrics(deal);

    expect(metrics.netQuantity).toBeCloseTo(1);
    expect(metrics.absQuantity).toBeCloseTo(1);
    expect(metrics.averageEntryPrice).toBeCloseTo(100);
    expect(metrics.exposure).toBeCloseTo(100);
    expect(metrics.pnl).toBeCloseTo(10);
    expect(metrics.pnlPercent).toBeCloseTo(10);
  });

  it('computes metrics for a short position', () => {
    const deal = createDeal({
      algorithm: 'SHORT',
      orders: [
        {
          id: 2,
          category: 'GRID',
          type: 'MARKET',
          side: 'SELL',
          position: 1,
          quantity: 1,
          filled: 1,
          price: 100,
          status: 'EXECUTED',
          publishedAt: '2025-10-07T00:00:00.000Z',
          executedAt: '2025-10-07T00:00:00.000Z',
        },
      ],
      price: 90,
    });

    const metrics = computeDealMetrics(deal);

    expect(metrics.netQuantity).toBeCloseTo(-1);
    expect(metrics.absQuantity).toBeCloseTo(1);
    expect(metrics.averageEntryPrice).toBeCloseTo(100);
    expect(metrics.exposure).toBeCloseTo(100);
    expect(metrics.pnl).toBeCloseTo(10);
    expect(metrics.pnlPercent).toBeCloseTo(10);
  });

  it('aggregates positions and sorts by pnl', () => {
    const gainDeal = createDeal({ id: 1, price: 110 });
    const lossDeal = createDeal({
      id: 2,
      botName: 'Losing Bot',
      price: 90,
    });

    const aggregation = aggregateDeals([gainDeal, lossDeal]);

    expect(aggregation.positions).toHaveLength(2);
    expect(aggregation.totalPnl).toBeCloseTo(0);
    expect(aggregation.profitableCount).toBe(1);
    expect(aggregation.losingCount).toBe(1);
    expect(aggregation.flatCount).toBe(0);
    expect(aggregation.positions[0].deal.id).toBe(1);
  });

  it('computes weighted entry price for multiple executed orders', () => {
    const deal = createDeal({
      orders: [
        {
          id: 1,
          category: 'GRID',
          type: 'MARKET',
          side: 'BUY',
          position: 1,
          quantity: 1,
          filled: 1,
          price: 100,
          status: 'EXECUTED',
          publishedAt: '2025-10-07T00:00:00.000Z',
          executedAt: '2025-10-07T00:00:00.000Z',
        },
        {
          id: 2,
          category: 'GRID',
          type: 'LIMIT',
          side: 'BUY',
          position: 2,
          quantity: 2,
          filled: 2,
          price: 80,
          status: 'EXECUTED',
          publishedAt: '2025-10-07T00:05:00.000Z',
          executedAt: '2025-10-07T00:05:00.000Z',
        },
      ],
    });

    const metrics = computeDealMetrics(deal);

    expect(metrics.netQuantity).toBeCloseTo(3);
    expect(metrics.averageEntryPrice).toBeCloseTo(86.6666667, 4);
    expect(metrics.exposure).toBeCloseTo(260);
  });
});
