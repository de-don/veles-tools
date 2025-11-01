import { describe, expect, it } from 'vitest';
import type { BacktestConfigDto, BacktestDepositConfigDto, BacktestStatisticsDto } from '../../api/backtests.dtos';
import type { BacktestDetail } from '../../types/backtests';
import { buildBotCreationPayload } from '../backtestBotPayload';

const buildStatistics = (overrides: Partial<BacktestStatisticsDto> = {}): BacktestStatisticsDto => ({
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
});

const buildConfig = (overrides: Partial<BacktestConfigDto> = {}): BacktestConfigDto => {
  const defaultDeposit: BacktestDepositConfigDto = {
    amount: 500,
    leverage: 5,
    marginType: 'CROSS',
    currency: 'BBB',
  };

  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Sample Backtest',
    symbol: overrides.symbol ?? 'AAA/BBB',
    exchange: overrides.exchange ?? 'BYBIT_FUTURES',
    algorithm: overrides.algorithm ?? 'LONG',
    pullUp: overrides.pullUp ?? 1,
    portion: overrides.portion ?? 2,
    profit:
      overrides.profit ??
      ({
        type: 'ABSOLUTE',
        currency: 'BBB',
        checkPnl: null,
        conditions: null,
      } satisfies BacktestConfigDto['profit']),
    deposit: overrides.deposit ?? defaultDeposit,
    stopLoss:
      overrides.stopLoss ??
      ({
        indent: null,
        termination: null,
        conditionalIndent: null,
        conditions: null,
        conditionalIndentType: null,
      } satisfies BacktestConfigDto['stopLoss']),
    settings: overrides.settings ?? null,
    conditions: overrides.conditions ?? [],
    from: overrides.from ?? '2024-01-01T00:00:00Z',
    to: overrides.to ?? '2024-02-01T00:00:00Z',
    status: overrides.status ?? 'FINISHED',
    commissions:
      overrides.commissions ??
      ({
        maker: null,
        taker: null,
      } satisfies BacktestConfigDto['commissions']),
    public: overrides.public ?? false,
    useWicks: overrides.useWicks ?? true,
    cursor: overrides.cursor ?? '',
  };
};

const buildDetail = ({
  stats,
  config,
  symbols,
  includePosition,
}: {
  stats?: Partial<BacktestStatisticsDto>;
  config?: Partial<BacktestConfigDto>;
  symbols?: string[] | null;
  includePosition?: boolean | null;
} = {}): BacktestDetail => {
  const resolvedConfig = buildConfig(config ?? {});
  const statistics = buildStatistics(stats);
  return {
    statistics: {
      ...statistics,
      deposit: resolvedConfig.deposit ?? null,
    },
    config: resolvedConfig,
    symbols: symbols ?? [resolvedConfig.symbol],
    includePosition: includePosition ?? true,
  };
};

describe('buildBotCreationPayload', () => {
  it('applies overrides for deposit and api key', () => {
    const detail = buildDetail({
      config: {
        deposit: {
          amount: 1000,
          leverage: 8,
          marginType: 'ISOLATED',
          currency: 'BBB',
        },
      },
    });

    const payload = buildBotCreationPayload(detail, {
      apiKeyId: 123,
      depositAmount: 2000,
      depositLeverage: 12,
      marginType: 'cross',
    });

    expect(payload.apiKey).toBe(123);
    expect(payload.id).toBeNull();
    expect(payload.termination).toBeNull();
    expect(payload.deposit.amount).toBe(2000);
    expect(payload.deposit.leverage).toBe(12);
    expect(payload.deposit.marginType).toBe('CROSS');
    expect(payload.deposit.currency).toBe('BBB');
    expect(payload.name).toBe('Sample Backtest');
    expect(payload.stopLoss).toEqual(detail.config.stopLoss);
    expect(payload.stopLoss).not.toBe(detail.config.stopLoss);
  });

  it('derives symbols when missing directly', () => {
    const detail = buildDetail({
      stats: { symbol: '', base: 'AAA', quote: 'BBB' },
      config: { symbol: '' },
      symbols: null,
    });

    const payload = buildBotCreationPayload(detail, {
      apiKeyId: 1,
      depositAmount: 100,
      depositLeverage: 5,
      marginType: 'cross',
    });

    expect(payload.symbols).toEqual(['AAA/BBB']);
    expect(payload.stopLoss).toEqual(detail.config.stopLoss);
  });

  it('uses override flags and symbols when provided', () => {
    const detail = buildDetail();

    const payload = buildBotCreationPayload(detail, {
      apiKeyId: 42,
      depositAmount: 500,
      depositLeverage: 10,
      marginType: 'isolated',
      symbols: ['  custom/usdt  ', ''],
    });

    expect(payload.symbols).toEqual(['custom/usdt']);
    expect(payload.apiKey).toBe(42);
    expect(payload.stopLoss).toEqual(detail.config.stopLoss);
  });
});
