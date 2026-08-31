import { describe, expect, it } from 'vitest';
import type { BacktestStatisticsDto, LegacyBacktestStatisticsDto } from '../../api/backtests.dtos';
import { mapStatisticsFromDto } from '../backtests.mappers';

const buildDto = (overrides: Partial<BacktestStatisticsDto & LegacyBacktestStatisticsDto> = {}) =>
  ({
    id: 1,
    name: 'test',
    date: '2026-05-09T10:39:56.575Z',
    from: '2026-04-27T02:13:00Z',
    to: '2026-05-09T10:39:56.247Z',
    algorithm: 'LONG',
    exchange: 'HYPERLIQUID_FUTURES',
    symbol: 'XMR/USDC',
    base: 'XMR',
    quote: 'USDC',
    duration: 0,
    profitBase: 0,
    profitQuote: 0,
    basePerDay: 0,
    quotePerDay: 0,
    minProfitBase: 0,
    maxProfitBase: 0,
    avgProfitBase: 0,
    minProfitQuote: 0,
    maxProfitQuote: 0,
    avgProfitQuote: 0,
    volume: 0,
    minDuration: 0,
    maxDuration: 0,
    avgDuration: 0,
    profits: 0,
    losses: 0,
    breakevens: 0,
    pullUps: 0,
    winRateProfits: 0,
    winRateLosses: 0,
    totalDeals: 0,
    minGrid: 0,
    maxGrid: 0,
    avgGrid: 0,
    minProfit: 0,
    maxProfit: 0,
    avgProfit: 0,
    mfePercent: 0,
    mfeAbsolute: 0,
    maePercent: 0,
    maeAbsolute: 0,
    commissionBase: null,
    commissionQuote: null,
    ...overrides,
  }) as BacktestStatisticsDto & LegacyBacktestStatisticsDto;

describe('mapStatisticsFromDto', () => {
  it('keeps the current schema values as is', () => {
    const mapped = mapStatisticsFromDto(buildDto({ profitQuote: 8.39, quotePerDay: 2.4 }));

    expect(mapped.profitQuote).toBe(8.39);
    expect(mapped.quotePerDay).toBe(2.4);
  });

  it('upgrades cached records that still use the legacy net* fields', () => {
    const legacy = buildDto({
      profitQuote: 9.02, // gross value from the old schema
      profitBase: 1,
      basePerDay: undefined as unknown as number,
      quotePerDay: undefined as unknown as number,
      netQuote: 8.37,
      netBase: 0.5,
      netQuotePerDay: 2.39,
      netBasePerDay: 0.1,
    });

    const mapped = mapStatisticsFromDto(legacy);

    expect(mapped.profitQuote).toBe(8.37);
    expect(mapped.profitBase).toBe(0.5);
    expect(mapped.quotePerDay).toBe(2.39);
    expect(mapped.basePerDay).toBe(0.1);
  });
});
