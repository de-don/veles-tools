import { describe, expect, it } from 'vitest';
import type { BacktestStatisticsDetail } from '../../types/backtests';
import { buildBotCreationPayload } from '../backtestBotPayload';

const buildDetail = (overrides: Partial<BacktestStatisticsDetail> = {}): BacktestStatisticsDetail => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? 'Sample Backtest',
  date: overrides.date ?? '2024-01-01T00:00:00Z',
  from: overrides.from ?? '2024-01-01T00:00:00Z',
  to: overrides.to ?? '2024-02-01T00:00:00Z',
  algorithm: overrides.algorithm ?? 'LONG',
  exchange: overrides.exchange ?? 'BYBIT_FUTURES',
  symbol: overrides.symbol ?? 'AAA/BBB',
  base: overrides.base ?? 'AAA',
  quote: overrides.quote ?? 'BBB',
  duration: overrides.duration ?? 0,
  profitBase: overrides.profitBase ?? 0,
  profitQuote: overrides.profitQuote ?? 0,
  netBase: overrides.netBase ?? 0,
  netQuote: overrides.netQuote ?? 0,
  netBasePerDay: overrides.netBasePerDay ?? 0,
  netQuotePerDay: overrides.netQuotePerDay ?? 0,
  minProfitBase: overrides.minProfitBase ?? 0,
  maxProfitBase: overrides.maxProfitBase ?? 0,
  avgProfitBase: overrides.avgProfitBase ?? 0,
  minProfitQuote: overrides.minProfitQuote ?? 0,
  maxProfitQuote: overrides.maxProfitQuote ?? 0,
  avgProfitQuote: overrides.avgProfitQuote ?? 0,
  volume: overrides.volume ?? 0,
  minDuration: overrides.minDuration ?? 0,
  maxDuration: overrides.maxDuration ?? 0,
  avgDuration: overrides.avgDuration ?? 0,
  profits: overrides.profits ?? 0,
  losses: overrides.losses ?? 0,
  breakevens: overrides.breakevens ?? 0,
  pullUps: overrides.pullUps ?? 0,
  winRateProfits: overrides.winRateProfits ?? 0,
  winRateLosses: overrides.winRateLosses ?? 0,
  totalDeals: overrides.totalDeals ?? 0,
  minGrid: overrides.minGrid ?? 0,
  maxGrid: overrides.maxGrid ?? 0,
  avgGrid: overrides.avgGrid ?? 0,
  minProfit: overrides.minProfit ?? 0,
  maxProfit: overrides.maxProfit ?? 0,
  avgProfit: overrides.avgProfit ?? 0,
  mfePercent: overrides.mfePercent ?? 0,
  mfeAbsolute: overrides.mfeAbsolute ?? 0,
  maePercent: overrides.maePercent ?? 0,
  maeAbsolute: overrides.maeAbsolute ?? 0,
  commissionBase: overrides.commissionBase ?? 0,
  commissionQuote: overrides.commissionQuote ?? 0,
  deposit: overrides.deposit ?? {
    amount: 500,
    leverage: 5,
    marginType: 'CROSS',
    currency: 'BBB',
  },
  pullUp: overrides.pullUp ?? 1,
  portion: overrides.portion ?? 2,
  profit: overrides.profit ?? null,
  settings: overrides.settings ?? { type: 'SIMPLE' },
  conditions: overrides.conditions ?? null,
  commissions: overrides.commissions ?? { maker: 0.01, taker: 0.02 },
  public: overrides.public ?? false,
  useWicks: overrides.useWicks ?? true,
  cursor: overrides.cursor ?? null,
  includePosition: overrides.includePosition ?? true,
  symbols: overrides.symbols ?? ['AAA/BBB'],
  start: overrides.start ?? null,
  end: overrides.end ?? null,
  periodStart: overrides.periodStart ?? null,
  periodEnd: overrides.periodEnd ?? null,
  dateFrom: overrides.dateFrom ?? null,
  dateTo: overrides.dateTo ?? null,
  date_from: overrides.date_from ?? null,
  date_to: overrides.date_to ?? null,
  range: overrides.range ?? null,
  period: overrides.period ?? null,
});

describe('buildBotCreationPayload', () => {
  it('applies overrides for deposit and api key', () => {
    const detail = buildDetail({
      deposit: {
        amount: 1000,
        leverage: 8,
        marginType: 'ISOLATED',
        currency: 'BBB',
      },
    });

    const payload = buildBotCreationPayload(detail, {
      apiKeyId: 123,
      depositAmount: 2000,
      depositLeverage: 12,
      marginType: 'cross',
    });

    expect(payload.apiKey).toBe(123);
    expect(payload.deposit?.amount).toBe(2000);
    expect(payload.deposit?.leverage).toBe(12);
    expect(payload.deposit?.marginType).toBe('CROSS');
    expect(payload.deposit?.currency).toBe('BBB');
    expect(payload.name).toBe(detail.name);
  });

  it('derives symbols when missing directly', () => {
    const detail = buildDetail({ symbol: '', symbols: null });

    const payload = buildBotCreationPayload(detail, {
      apiKeyId: 1,
      depositAmount: 100,
      depositLeverage: 5,
      marginType: 'cross',
    });

    expect(payload.symbols).toEqual(['AAA/BBB']);
    expect(payload.symbol).toBe('AAA/BBB');
  });
});
