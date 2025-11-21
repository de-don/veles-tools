import { describe, expect, it, vi } from 'vitest';
import type { BacktestConfigDto } from '../../api/backtests.dtos';
import type { BacktestCycle, BacktestDetail, BacktestOrder, BacktestStatistics } from '../../types/backtests';
import { buildBacktestInfo } from '../backtestInfos';

const baseConfig: BacktestConfigDto = {
  id: 1,
  name: 'Test Config',
  symbol: 'BTCUSDT',
  exchange: 'BINANCE',
  algorithm: 'GRID',
  pullUp: 0,
  portion: 0,
  profit: null,
  deposit: {
    amount: 500,
    leverage: 10,
    marginType: 'CROSS',
    currency: 'USDT',
  },
  stopLoss: null,
  settings: {
    type: 'GRID',
    includePosition: null,
  },
  conditions: [],
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-05T00:00:00Z',
  status: 'FINISHED',
  commissions: {
    maker: null,
    taker: null,
  },
  public: false,
  useWicks: false,
  cursor: 'cursor',
};

const baseStatistics: BacktestStatistics = {
  id: 1,
  name: 'Backtest A',
  date: '2024-01-05T00:00:00Z',
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-05T00:00:00Z',
  algorithm: 'GRID',
  exchange: 'BINANCE',
  symbol: 'BTCUSDT',
  base: 'BTC',
  quote: 'USDT',
  duration: 0,
  profitBase: 0,
  profitQuote: 150,
  netBase: 0,
  netQuote: 150,
  netBasePerDay: 0,
  netQuotePerDay: 30,
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
  profits: 2,
  losses: 1,
  breakevens: 0,
  pullUps: 0,
  winRateProfits: 0,
  winRateLosses: 0,
  totalDeals: 3,
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
  commissionBase: 0,
  commissionQuote: 0,
};

const createOrder = (overrides: Partial<BacktestOrder> = {}): BacktestOrder => ({
  category: 'GRID',
  side: 'BUY',
  type: 'MARKET',
  position: 1,
  quantity: 1,
  price: 1,
  status: 'EXECUTED',
  createdAt: '2024-01-01T00:00:00Z',
  executedAt: '2024-01-01T00:05:00Z',
  commissionAmount: 0,
  commissionAsset: 'USDT',
  ...overrides,
});

const createCycle = (overrides: Partial<BacktestCycle> = {}): BacktestCycle => ({
  date: overrides.date ?? '2024-01-02T00:30:00Z',
  status: overrides.status ?? 'FINISHED',
  substatus: overrides.substatus ?? 'TAKE_PROFIT',
  exchange: overrides.exchange ?? 'BINANCE',
  symbol: overrides.symbol ?? 'BTCUSDT',
  base: overrides.base ?? 'BTC',
  quote: overrides.quote ?? 'USDT',
  profitQuote: overrides.profitQuote ?? 0,
  profitBase: overrides.profitBase ?? 0,
  netQuote: overrides.netQuote ?? 0,
  netBase: overrides.netBase ?? 0,
  pnl: overrides.pnl ?? 0,
  duration: overrides.duration ?? 0,
  grid: overrides.grid ?? 0,
  executedGrid: overrides.executedGrid ?? 0,
  profits: overrides.profits ?? 0,
  executedProfits: overrides.executedProfits ?? 0,
  volume: overrides.volume ?? 0,
  mfePercent: overrides.mfePercent ?? 0,
  mfeAbsolute: overrides.mfeAbsolute ?? 0,
  maePercent: overrides.maePercent ?? 0,
  maeAbsolute: overrides.maeAbsolute ?? 0,
  commissionBase: overrides.commissionBase ?? 0,
  commissionQuote: overrides.commissionQuote ?? 0,
  orders: overrides.orders ?? [createOrder()],
});

const createDetail = (overrides: Partial<BacktestDetail> = {}): BacktestDetail => ({
  statistics: { ...baseStatistics, ...(overrides.statistics ?? {}) },
  config: { ...baseConfig, ...(overrides.config ?? {}) },
});

describe('buildBacktestInfo', () => {
  it('maps base data and computes derived metrics', () => {
    const detail = createDetail();

    const cycles: BacktestCycle[] = [
      createCycle({
        date: '2024-01-02T00:30:00Z',
        pnl: 100,
        netQuote: 100,
        maeAbsolute: 10,
        mfeAbsolute: 30,
        duration: 1800,
        orders: [
          createOrder({
            createdAt: '2024-01-02T00:00:00Z',
            executedAt: '2024-01-02T00:30:00Z',
          }),
        ],
      }),
      createCycle({
        date: '2024-01-03T02:00:00Z',
        pnl: -150,
        netQuote: -150,
        maeAbsolute: 40,
        mfeAbsolute: 15,
        duration: 7200,
        orders: [
          createOrder({
            createdAt: '2024-01-03T00:00:00Z',
            executedAt: '2024-01-03T02:00:00Z',
          }),
        ],
      }),
      createCycle({
        date: '2024-01-04T06:00:00Z',
        pnl: 200,
        netQuote: 200,
        maeAbsolute: 5,
        mfeAbsolute: 60,
        duration: 3600,
        orders: [
          createOrder({
            createdAt: '2024-01-04T05:00:00Z',
            executedAt: '2024-01-04T06:00:00Z',
          }),
        ],
      }),
      createCycle({
        date: '2024-01-05T01:00:00Z',
        status: 'STARTED',
        pnl: -20,
        netQuote: -20,
        maeAbsolute: 25,
        mfeAbsolute: 5,
        duration: 900,
        orders: [
          createOrder({
            createdAt: '2024-01-05T01:00:00Z',
            executedAt: '2024-01-05T01:05:00Z',
          }),
        ],
      }),
    ];

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2024-01-05T12:00:00Z'));

    const info = buildBacktestInfo(detail, cycles);

    expect(info.depositAmount).toBe(500);
    expect(info.depositCurrency).toBe('USDT');
    expect(info.leverage).toBe(10);
    expect(info.winRatePercent).toBeCloseTo((2 / 3) * 100, 5);
    expect(info.activeMaeAbsolute).toBe(25);
    expect(info.maxDrawdownQuote).toBe(150);
    expect(info.tradingDays).toBe(4);
    const totalDurationMs = info.deals.reduce((sum, deal) => sum + (deal.end - deal.start), 0);
    const expectedAverageDays = totalDurationMs / info.deals.length / (24 * 60 * 60 * 1000);
    expect(info.averageDurationDays).toBeCloseTo(expectedAverageDays, 6);
    expect(info.maxMaeAbsolute).toBe(40);
    expect(info.avgMaeAbsolute).toBeCloseTo((10 + 40 + 5 + 25) / 4, 5);
    expect(info.maxMfeAbsolute).toBe(60);
    expect(info.avgMfeAbsolute).toBeCloseTo((30 + 15 + 60 + 5) / 4, 5);
    expect(info.pnlMaeRatio).toBeCloseTo(detail.statistics.netQuote / 40, 5);

    nowSpy.mockRestore();
  });

  it('returns sane defaults when there are no cycles', () => {
    const detail = createDetail({
      statistics: {
        ...baseStatistics,
        profits: 0,
        losses: 0,
      },
    });

    const info = buildBacktestInfo(detail, []);

    expect(info.tradingDays).toBe(0);
    expect(info.averageDurationDays).toBe(0);
    expect(info.activeMaeAbsolute).toBeNull();
    expect(info.maxMaeAbsolute).toBe(0);
    expect(info.maxMfeAbsolute).toBe(0);
    expect(info.maxDrawdownQuote).toBe(0);
    expect(info.winRatePercent).toBeNull();
    expect(info.pnlMaeRatio).toBeNull();
  });

  it('counts trading days across overlapping deals', () => {
    const detail = createDetail();
    const cycles: BacktestCycle[] = [
      createCycle({
        date: '2024-02-01T12:00:00Z',
        orders: [
          createOrder({
            createdAt: '2024-02-01T08:00:00Z',
            executedAt: '2024-02-01T12:00:00Z',
          }),
        ],
      }),
      createCycle({
        date: '2024-02-02T03:00:00Z',
        orders: [
          createOrder({
            createdAt: '2024-02-01T20:00:00Z',
            executedAt: '2024-02-02T03:00:00Z',
          }),
        ],
      }),
      createCycle({
        date: '2024-02-03T02:00:00Z',
        orders: [
          createOrder({
            createdAt: '2024-02-03T00:00:00Z',
            executedAt: '2024-02-03T02:00:00Z',
          }),
        ],
      }),
    ];

    const info = buildBacktestInfo(detail, cycles);
    expect(info.tradingDays).toBe(3);
  });
});
