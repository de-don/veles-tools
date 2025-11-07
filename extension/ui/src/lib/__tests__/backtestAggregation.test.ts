import { describe, expect, it } from 'vitest';
import type { BacktestConfigDto, BacktestStatisticsDto } from '../../api/backtests.dtos';
import type { BotSettingsDto } from '../../api/bots.dtos';
import type { BacktestCycle, BacktestDetail, BacktestOrder, BacktestStatistics } from '../../types/backtests';
import {
  type AggregationSummary,
  computeBacktestMetrics,
  MS_IN_DAY,
  summarizeAggregations,
} from '../backtestAggregation';

const baseStatistics: BacktestStatisticsDto = {
  id: 1,
  name: 'Base Backtest',
  date: '2024-01-01T00:00:00Z',
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-02T00:00:00Z',
  algorithm: 'demo',
  exchange: 'BINANCE',
  symbol: 'AAA/BBB',
  base: 'AAA',
  quote: 'BBB',
  duration: 0,
  profitBase: 0,
  profitQuote: 0,
  netBase: 0,
  netQuote: 0,
  netBasePerDay: 0,
  netQuotePerDay: 0,
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
  commissionBase: 0,
  commissionQuote: 0,
};

const baseConfig: BacktestConfigDto = {
  id: 1,
  name: 'Base Backtest',
  symbol: 'AAA/BBB',
  exchange: 'BINANCE',
  algorithm: 'demo',
  pullUp: 0,
  portion: 0,
  profit: {
    type: 'ABSOLUTE',
    currency: 'BBB',
    checkPnl: null,
    conditions: null,
  },
  deposit: {
    amount: 0,
    leverage: 0,
    marginType: 'CROSS',
    currency: 'BBB',
  },
  stopLoss: {
    indent: null,
    termination: null,
    conditionalIndent: null,
    conditions: null,
    conditionalIndentType: null,
  },
  settings: buildDefaultSettings(),
  conditions: [],
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-02T00:00:00Z',
  status: 'FINISHED',
  commissions: {
    maker: null,
    taker: null,
  },
  public: false,
  useWicks: false,
  cursor: '',
};

function buildDefaultSettings(): BotSettingsDto {
  return {
    type: 'GRID',
    includePosition: null,
  } satisfies BotSettingsDto;
}

const buildDetail = ({
  stats,
  config,
}: {
  stats?: Partial<BacktestStatisticsDto>;
  config?: Partial<BacktestConfigDto>;
} = {}): BacktestDetail => {
  const resolvedConfig: BacktestConfigDto = {
    ...baseConfig,
    ...(config ?? {}),
    settings: config?.settings ? { ...config.settings } : buildDefaultSettings(),
  };

  const statistics: BacktestStatistics = {
    ...baseStatistics,
    ...(stats ?? {}),
  };

  return {
    statistics,
    config: resolvedConfig,
  };
};

const baseCycle: BacktestCycle = {
  id: 1,
  date: '2024-01-01T00:00:00Z',
  status: 'FINISHED',
  substatus: 'TAKE_PROFIT',
  exchange: 'BINANCE',
  symbol: 'AAA/BBB',
  base: 'AAA',
  quote: 'BBB',
  profitQuote: 0,
  profitBase: 0,
  netQuote: 0,
  netBase: 0,
  pnl: 0,
  duration: 0,
  grid: 0,
  executedGrid: 0,
  profits: 0,
  executedProfits: 0,
  volume: 0,
  mfePercent: 0,
  mfeAbsolute: 0,
  maePercent: 0,
  maeAbsolute: 0,
  commissionBase: 0,
  commissionQuote: 0,
  orders: [],
};

const buildCycle = (overrides: Partial<BacktestCycle> = {}, orders: BacktestOrder[] = []): BacktestCycle => {
  const { substatus, orders: overrideOrders, ...rest } = overrides;
  return {
    ...baseCycle,
    ...rest,
    substatus: substatus ?? baseCycle.substatus,
    orders: overrideOrders ?? orders,
  };
};

const buildOrder = (overrides: Partial<BacktestOrder> = {}): BacktestOrder => ({
  category: 'GRID',
  side: 'BUY',
  type: 'MARKET',
  position: overrides.position ?? 0,
  quantity: overrides.quantity ?? 1,
  price: overrides.price ?? 1,
  status: 'EXECUTED',
  createdAt: overrides.createdAt ?? '2024-01-01T00:00:00Z',
  executedAt: overrides.executedAt ?? overrides.createdAt ?? '2024-01-01T00:00:01Z',
  commissionAmount: overrides.commissionAmount ?? 0,
  commissionAsset: overrides.commissionAsset ?? 'USDT',
});

const buildMetricsWithRiskWindow = ({
  id,
  start,
  end,
  mae,
}: {
  id: number;
  start: string;
  end: string;
  mae: number;
}) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const rawDurationSec = (endMs - startMs) / 1000;
  const durationSec = Number.isFinite(rawDurationSec) && rawDurationSec > 0 ? rawDurationSec : 0;

  return computeBacktestMetrics(
    buildDetail({
      stats: {
        id,
        from: start,
        to: end,
        totalDeals: 1,
        losses: 1,
        avgDuration: durationSec,
      },
    }),
    [
      buildCycle({
        id,
        date: end,
        duration: durationSec,
        maeAbsolute: mae,
        mfeAbsolute: mae,
      }),
    ],
  );
};

const expectRiskEfficiencyConsistency = (summary: AggregationSummary): void => {
  expect(summary.aggregateWorstRisk).toBe(Math.max(summary.aggregateDrawdown, summary.aggregateMPU));
  if (summary.aggregateWorstRisk > 0) {
    expect(summary.aggregateRiskEfficiency).toBeCloseTo(summary.totalPnl / summary.aggregateWorstRisk, 6);
  } else {
    expect(summary.aggregateRiskEfficiency).toBeNull();
  }
};

describe('computeBacktestMetrics', () => {
  it('aggregates statistics and cycles into consistent metrics', () => {
    const detail = buildDetail({
      stats: {
        id: 42,
        name: 'Strategy A',
        symbol: 'AAA/BBB',
        base: 'AAA',
        quote: 'BBB',
        netQuote: 150,
        netQuotePerDay: 25,
        profits: 2,
        losses: 1,
        totalDeals: 3,
        avgDuration: 3600,
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-10T00:00:00Z',
        winRateProfits: 2,
        winRateLosses: 1,
      },
      config: {
        deposit: {
          amount: 2500,
          leverage: 5,
          marginType: 'CROSS',
          currency: 'USDT',
        },
      },
    });

    const cycles: BacktestCycle[] = [
      buildCycle(
        {
          id: 1,
          date: '2024-01-03T00:00:00Z',
          duration: 7200,
          netQuote: 100,
          mfeAbsolute: 120,
          maeAbsolute: 25,
        },
        [
          buildOrder({
            createdAt: '2024-01-02T22:30:00Z',
            executedAt: '2024-01-02T22:30:00Z',
          }),
        ],
      ),
      buildCycle({
        id: 2,
        date: '2024-01-05T00:00:00Z',
        duration: 3600,
        netQuote: -40,
        mfeAbsolute: 10,
        maeAbsolute: 0,
      }),
      buildCycle({
        id: 3,
        date: '2024-01-07T06:00:00Z',
        duration: 1800,
        netQuote: 20,
        mfeAbsolute: 35,
        maeAbsolute: 45,
      }),
      buildCycle({
        id: 4,
        date: '2024-01-08T00:00:00Z',
        status: 'STARTED',
        duration: 3600,
        netQuote: 30,
      }),
    ];

    const metrics = computeBacktestMetrics(detail, cycles);

    expect(metrics.id).toBe(42);
    expect(metrics.pnl).toBe(150);
    expect(metrics.profitsCount).toBe(2);
    expect(metrics.lossesCount).toBe(1);
    expect(metrics.totalDeals).toBe(3);
    expect(metrics.totalTradeDurationSec).toBe(10800);
    expect(metrics.avgTradeDurationDays).toBeCloseTo(0.04166, 4);
    expect(metrics.avgNetPerDay).toBe(25);
    expect(metrics.maxDrawdown).toBe(40);
    expect(metrics.maxMPU).toBe(45);
    expect(metrics.maxMPP).toBe(120);
    expect(metrics.worstRisk).toBe(45);
    expect(metrics.riskEfficiency).toBeCloseTo(3.3333333, 4);
    expect(metrics.depositAmount).toBe(2500);
    expect(metrics.depositLeverage).toBe(5);
    expect(metrics.depositCurrency).toBe('USDT');
    expect(metrics.winRatePercent).toBeCloseTo((2 / 3) * 100, 6);
    expect(metrics.concurrencyIntervals).toHaveLength(4);
    expect(metrics.concurrencyIntervals[0].start).toBe(new Date('2024-01-02T22:30:00Z').getTime());
    expect(metrics.concurrencyIntervals[0].end).toBe(new Date('2024-01-03T00:00:00Z').getTime());
    expect(metrics.equityEvents).toHaveLength(3);
    expect(metrics.activeDurationMs).toBe(14_400_000);
    expect(metrics.downtimeDays).toBeCloseTo(8.8333, 4);
    expect(metrics.spanStart).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    expect(metrics.spanEnd).toBe(new Date('2024-01-10T00:00:00Z').getTime());
    expect(metrics.activeMpu).toBe(0);
    expect(metrics.openPosition).toMatchObject({ cycleId: 4, mpu: 0 });
    expect(metrics.openPosition?.start).toBeDefined();
    expect(metrics.openPosition?.lastUpdate).toBeDefined();

    const jan2Index = Math.floor(new Date('2024-01-02T00:00:00Z').getTime() / MS_IN_DAY);
    const jan7Index = Math.floor(new Date('2024-01-07T00:00:00Z').getTime() / MS_IN_DAY);
    expect(metrics.activeDayIndices).toContain(jan2Index);
    expect(metrics.activeDayIndices).toContain(jan7Index);
    expect(metrics.trades).toHaveLength(3);
    expect(metrics.trades[0]).toMatchObject({ net: 100, mfe: 120, mae: 25 });
    expect(metrics.trades[1]).toMatchObject({ net: -40, mfe: 10, mae: 0 });
  });

  it('handles incomplete stats ranges and missing cycle durations', () => {
    const detail = buildDetail({
      stats: {
        id: 77,
        name: 'Edge Strategy',
        netQuote: 90,
        netQuotePerDay: 18,
        profits: 3,
        losses: 1,
        totalDeals: 4,
        avgDuration: 1800,
        from: 'not-a-date',
        to: 'still-not-a-date',
      },
      config: {
        from: '2024-02-01T00:00:00Z',
        to: '2024-02-04T00:00:00Z',
      },
    });

    const finishedWithOrders = buildCycle(
      {
        id: 501,
        date: '2024-02-02T12:00:00Z',
        duration: Number.NaN,
        netQuote: 75,
        mfeAbsolute: 50,
        maeAbsolute: -20,
      },
      [
        buildOrder({ createdAt: '2024-02-02T08:00:00Z', executedAt: '2024-02-02T08:00:00Z' }),
        buildOrder({ createdAt: '2024-02-02T09:30:00Z', executedAt: '2024-02-02T09:30:00Z' }),
      ],
    );

    const finishedWithoutOrders = buildCycle({
      id: 502,
      date: '2024-02-03T18:00:00Z',
      duration: Number.NaN,
      netQuote: Number.NaN,
      mfeAbsolute: -5,
      maeAbsolute: 0,
    });

    const runningCycle = buildCycle({
      id: 503,
      status: 'STARTED',
      date: '2024-02-03T08:00:00Z',
      duration: 3600,
      netQuote: 40,
      mfeAbsolute: 10,
      maeAbsolute: 5,
    });

    const metrics = computeBacktestMetrics(detail, [finishedWithOrders, finishedWithoutOrders, runningCycle]);

    const expectedSpanStart = new Date('2024-02-01T00:00:00Z').getTime();
    const expectedSpanEnd = new Date('2024-02-04T00:00:00Z').getTime();

    expect(metrics.spanStart).toBe(expectedSpanStart);
    expect(metrics.spanEnd).toBe(expectedSpanEnd);
    expect(metrics.activeDurationMs).toBeGreaterThan(0);

    expect(metrics.concurrencyIntervals).toHaveLength(3);
    const [firstInterval, secondInterval, thirdInterval] = metrics.concurrencyIntervals;
    expect(firstInterval.start).toBeLessThanOrEqual(secondInterval.start);
    expect(secondInterval.start).toBeLessThanOrEqual(thirdInterval.start);

    expect(metrics.trades).toHaveLength(2);
    expect(metrics.trades[0]).toMatchObject({
      id: 501,
      net: 75,
      mfe: 50,
      mae: 20,
    });
    expect(metrics.trades[1]).toMatchObject({ id: 502, net: 0, mfe: 0 });

    expect(metrics.maxMPP).toBe(50);
    expect(metrics.maxMPU).toBe(20);

    expect(metrics.equityEvents).toHaveLength(1);
    expect(metrics.riskIntervals).toHaveLength(2);

    const uniqueDayIndices = new Set(metrics.activeDayIndices);
    expect(uniqueDayIndices.size).toBe(metrics.activeDayIndices.length);
    expect(metrics.activeDayIndices[0]).toBeLessThanOrEqual(
      metrics.activeDayIndices[metrics.activeDayIndices.length - 1],
    );
    expect(metrics.activeMpu).toBe(5);
    expect(metrics.openPosition).toMatchObject({ cycleId: 503, mpu: 5 });
    expect(metrics.openPosition?.start).not.toBeNull();
    expect(metrics.openPosition?.lastUpdate).not.toBeNull();
    expect(metrics.depositAmount).toBeNull();
    expect(metrics.depositLeverage).toBeNull();
    expect(metrics.winRatePercent).toBeCloseTo((3 / 4) * 100, 6);
  });

  it('normalizes textual deposit configuration values', () => {
    const detail = buildDetail({
      stats: {
        id: 909,
        winRateProfits: 5,
        winRateLosses: 5,
        quote: 'USDT',
      },
      config: {
        deposit: {
          amount: '1 250,75 USDT' as unknown as number,
          leverage: '10x' as unknown as number,
          marginType: 'ISOLATED',
          currency: null,
        },
      },
    });

    const metrics = computeBacktestMetrics(detail, []);

    expect(metrics.depositAmount).toBeCloseTo(1250.75, 6);
    expect(metrics.depositCurrency).toBe('USDT');
    expect(metrics.depositLeverage).toBe(10);
    expect(metrics.winRatePercent).toBe(50);
  });

  it('derives started cycle start time from the earliest order', () => {
    const firstOrder = '2024-07-01T08:15:00Z';
    const secondOrder = '2024-07-01T09:45:00Z';
    const closingTime = '2024-07-01T12:00:00Z';

    const detail = buildDetail({
      stats: {
        id: 1001,
        from: '2024-07-01T00:00:00Z',
        to: '2024-07-02T00:00:00Z',
      },
    });

    const startedCycle = buildCycle(
      {
        id: 7001,
        status: 'STARTED',
        date: closingTime,
        duration: 18_000,
      },
      [
        buildOrder({ createdAt: firstOrder, executedAt: firstOrder }),
        buildOrder({ createdAt: secondOrder, executedAt: secondOrder }),
      ],
    );

    const metrics = computeBacktestMetrics(detail, [startedCycle]);

    const expectedStart = new Date(firstOrder).getTime();
    const expectedEnd = new Date(closingTime).getTime();

    expect(metrics.concurrencyIntervals).toHaveLength(1);
    expect(metrics.concurrencyIntervals[0].start).toBe(expectedStart);
    expect(metrics.concurrencyIntervals[0].end).toBe(expectedEnd);
    const statsStart = new Date('2024-07-01T00:00:00Z').getTime();
    expect(metrics.spanStart).toBe(Math.min(statsStart, expectedStart));
    const statsEnd = new Date('2024-07-02T00:00:00Z').getTime();
    expect(metrics.spanEnd).toBe(Math.max(statsEnd, expectedEnd));
    expect(metrics.activeDayIndices).toContain(Math.floor(expectedStart / MS_IN_DAY));
  });

  it('returns null openPosition when no cycles are running', () => {
    const detail = buildDetail({
      stats: {
        id: 321,
        totalDeals: 2,
        profits: 2,
        losses: 0,
      },
    });

    const cycles = [
      buildCycle({ id: 11, date: '2024-03-01T00:00:00Z', netQuote: 25, mfeAbsolute: 15, maeAbsolute: 4 }),
      buildCycle({ id: 12, date: '2024-03-02T00:00:00Z', netQuote: -10, mfeAbsolute: 8, maeAbsolute: 6 }),
    ];

    const metrics = computeBacktestMetrics(detail, cycles);

    expect(metrics.activeMpu).toBe(0);
    expect(metrics.openPosition).toBeNull();
  });
});

describe('summarizeAggregations', () => {
  it('returns zeroed summary when no metrics provided', () => {
    const summary = summarizeAggregations([]);

    expect(summary.totalSelected).toBe(0);
    expect(summary.totalPnl).toBe(0);
    expect(summary.totalProfits).toBe(0);
    expect(summary.totalLosses).toBe(0);
    expect(summary.totalDeals).toBe(0);
    expect(summary.avgPnlPerDeal).toBe(0);
    expect(summary.avgPnlPerBacktest).toBe(0);
    expect(summary.avgNetPerDay).toBe(0);
    expect(summary.avgTradeDurationDays).toBe(0);
    expect(summary.avgMaxDrawdown).toBe(0);
    expect(summary.aggregateDrawdown).toBe(0);
    expect(summary.aggregateMPU).toBe(0);
    expect(summary.aggregateWorstRisk).toBe(0);
    expect(summary.aggregateRiskEfficiency).toBeNull();
    expect(summary.maxConcurrent).toBe(0);
    expect(summary.avgConcurrent).toBe(0);
    expect(summary.noTradeDays).toBe(0);
    expect(summary.dailyConcurrency.records).toEqual([]);
    expect(summary.dailyConcurrency.stats).toEqual({
      meanMax: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      limits: { p75: 0, p90: 0, p95: 0 },
    });
    expect(summary.portfolioEquity).toEqual({
      points: [],
      minValue: 0,
      maxValue: 0,
    });
    expect(summary.aggregateRiskSeries).toEqual({ points: [], maxValue: 0 });
    expectRiskEfficiencyConsistency(summary);
  });

  it('aggregates multiple backtests into portfolio-level metrics', () => {
    const metricsA = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 101,
          name: 'Strategy Alpha',
          netQuote: 150,
          netQuotePerDay: 12.5,
          profits: 2,
          losses: 1,
          totalDeals: 3,
          avgDuration: 3600,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-10T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 1,
          date: '2024-01-03T00:00:00Z',
          duration: 7200,
          netQuote: 100,
          mfeAbsolute: 150,
          maeAbsolute: 25,
        }),
        buildCycle({
          id: 2,
          date: '2024-01-05T00:00:00Z',
          duration: 3600,
          netQuote: -40,
          mfeAbsolute: 30,
        }),
        buildCycle({
          id: 3,
          date: '2024-01-07T06:00:00Z',
          duration: 1800,
          netQuote: 20,
          mfeAbsolute: 60,
          maeAbsolute: 45,
        }),
      ],
    );

    const metricsB = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 202,
          name: 'Strategy Beta',
          netQuote: -50,
          netQuotePerDay: -3,
          profits: 1,
          losses: 2,
          totalDeals: 3,
          avgDuration: 5400,
          from: '2024-01-02T00:00:00Z',
          to: '2024-01-08T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 10,
          date: '2024-01-03T01:30:00Z',
          duration: 7200,
          netQuote: 20,
          mfeAbsolute: 40,
          maeAbsolute: 15,
        }),
        buildCycle({
          id: 11,
          date: '2024-01-04T08:00:00Z',
          duration: 7200,
          netQuote: -70,
          mfeAbsolute: 20,
          maeAbsolute: 35,
          orders: [
            buildOrder({
              createdAt: '2024-01-04T05:30:00Z',
              executedAt: '2024-01-04T05:30:00Z',
            }),
          ],
        }),
      ],
    );

    const summary = summarizeAggregations([metricsA, metricsB]);

    expect(summary.totalSelected).toBe(2);
    expect(summary.totalPnl).toBe(metricsA.pnl + metricsB.pnl);
    expect(summary.totalProfits).toBe(metricsA.profitsCount + metricsB.profitsCount);
    expect(summary.totalLosses).toBe(metricsA.lossesCount + metricsB.lossesCount);
    expect(summary.totalDeals).toBe(metricsA.totalDeals + metricsB.totalDeals);
    expect(summary.avgPnlPerDeal).toBeCloseTo(summary.totalPnl / summary.totalDeals, 10);
    expect(summary.avgPnlPerBacktest).toBeCloseTo(summary.totalPnl / summary.totalSelected, 10);
    expect(summary.avgNetPerDay).toBeCloseTo(
      (metricsA.avgNetPerDay + metricsB.avgNetPerDay) / summary.totalSelected,
      10,
    );
    expect(summary.avgTradeDurationDays).toBeCloseTo(
      (metricsA.totalTradeDurationSec + metricsB.totalTradeDurationSec) / summary.totalDeals / 86400,
      6,
    );
    expect(summary.avgMaxDrawdown).toBeCloseTo((metricsA.maxDrawdown + metricsB.maxDrawdown) / 2, 6);
    expect(summary.aggregateDrawdown).toBeGreaterThanOrEqual(Math.max(metricsA.maxDrawdown, metricsB.maxDrawdown));
    expect(summary.aggregateMPU).toBeGreaterThanOrEqual(Math.max(metricsA.maxMPU, metricsB.maxMPU));
    expectRiskEfficiencyConsistency(summary);
    expect(summary.aggregateRiskSeries.maxValue).toBe(summary.aggregateMPU);
    expect(summary.aggregateRiskSeries.points.length).toBeGreaterThan(0);
    expect(summary.maxConcurrent).toBeGreaterThanOrEqual(2);
    expect(summary.avgConcurrent).toBeGreaterThan(0);
    expect(summary.noTradeDays).toBeGreaterThan(0);

    const jan3DayIndex = Math.floor(new Date('2024-01-03T00:00:00Z').getTime() / MS_IN_DAY);
    expect(summary.dailyConcurrency.records.some((record) => record.dayIndex === jan3DayIndex)).toBe(true);

    const allTrades = [...metricsA.trades, ...metricsB.trades]
      .filter((trade) => Number.isFinite(trade.end))
      .sort((a, b) => {
        if (a.end === b.end) {
          if (a.start === b.start) {
            return a.id - b.id;
          }
          if (!Number.isFinite(a.start)) {
            return 1;
          }
          if (!Number.isFinite(b.start)) {
            return -1;
          }
          return Number(a.start) - Number(b.start);
        }
        return Number(a.end) - Number(b.end);
      });

    expect(summary.portfolioEquity.points.length).toBe(allTrades.length + 1);
    expect(summary.portfolioEquity.points[0].value).toBe(0);

    let rollingValue = 0;
    allTrades.forEach((trade, index) => {
      const point = summary.portfolioEquity.points[index + 1];
      rollingValue += trade.net;
      expect(point.value).toBeCloseTo(rollingValue, 6);
    });

    expect(summary.portfolioEquity.maxValue).toBeGreaterThanOrEqual(summary.portfolioEquity.minValue);
  });

  it('includes open positions in aggregate risk metrics', () => {
    const metricsClosedOnly = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 601,
          from: '2024-05-01T00:00:00Z',
          to: '2024-05-02T00:00:00Z',
          netQuote: 30,
          totalDeals: 1,
          profits: 1,
        },
      }),
      [
        buildCycle({
          id: 6011,
          date: '2024-05-02T00:00:00Z',
          duration: 3600,
          netQuote: 30,
          mfeAbsolute: 18,
          maeAbsolute: 6,
        }),
      ],
    );

    const metricsWithOpen = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 602,
          from: '2024-05-01T00:00:00Z',
          to: '2024-05-04T00:00:00Z',
          netQuote: 20,
          totalDeals: 1,
          profits: 1,
        },
      }),
      [
        buildCycle({
          id: 6021,
          date: '2024-05-02T00:00:00Z',
          duration: 3600,
          netQuote: 20,
          mfeAbsolute: 12,
          maeAbsolute: 3,
        }),
        buildCycle({
          id: 6022,
          status: 'STARTED',
          date: '2024-05-04T00:00:00Z',
          duration: 7200,
          netQuote: -5,
          mfeAbsolute: 40,
          maeAbsolute: 25,
        }),
      ],
    );

    const summary = summarizeAggregations([metricsClosedOnly, metricsWithOpen]);

    expect(metricsWithOpen.openPosition).toMatchObject({ cycleId: 6022, mpu: 25 });
    expect(metricsWithOpen.openPosition?.start).toBeDefined();
    expect(metricsWithOpen.openPosition?.lastUpdate).toBeDefined();
    expect(summary.openDeals).toBe(1);
    expect(summary.activeMpu).toBe(25);
    expect(summary.aggregateMPU).toBeGreaterThanOrEqual(25);
    expect(summary.aggregateWorstRisk).toBe(Math.max(summary.aggregateDrawdown, summary.aggregateMPU));
  });

  it('preserves open position risk under concurrency limit', () => {
    const metricsWithOpenA = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 701,
          from: '2024-06-01T00:00:00Z',
          to: '2024-06-04T00:00:00Z',
          netQuote: 18,
          totalDeals: 1,
          profits: 1,
        },
      }),
      [
        buildCycle({
          id: 7011,
          date: '2024-06-02T00:00:00Z',
          duration: 3600,
          netQuote: 18,
          mfeAbsolute: 20,
          maeAbsolute: 8,
        }),
        buildCycle({
          id: 7012,
          status: 'STARTED',
          date: '2024-06-04T00:00:00Z',
          duration: 7200,
          netQuote: -7,
          mfeAbsolute: 30,
          maeAbsolute: 25,
        }),
      ],
    );

    const metricsWithOpenB = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 702,
          from: '2024-06-01T00:00:00Z',
          to: '2024-06-05T00:00:00Z',
          netQuote: 12,
          totalDeals: 1,
          profits: 1,
        },
      }),
      [
        buildCycle({
          id: 7021,
          date: '2024-06-02T00:30:00Z',
          duration: 5400,
          netQuote: 12,
          mfeAbsolute: 14,
          maeAbsolute: 6,
        }),
        buildCycle({
          id: 7022,
          status: 'STARTED',
          date: '2024-06-05T00:00:00Z',
          duration: 3600,
          netQuote: -3,
          mfeAbsolute: 18,
          maeAbsolute: 15,
        }),
      ],
    );

    const summary = summarizeAggregations([metricsWithOpenA, metricsWithOpenB], { maxConcurrentBots: 1 });

    expect(summary.openDeals).toBe(1);
    expect(summary.activeMpu).toBe(25);
    expect(summary.aggregateMPU).toBe(25);
    expect(summary.aggregateWorstRisk).toBe(Math.max(summary.aggregateDrawdown, summary.aggregateMPU));
  });

  it('keeps aggregate MPU within lock when an open deal never closes', () => {
    const openStart = '2024-07-02T00:00:00Z';
    const openMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 801,
          from: openStart,
          to: '2024-07-10T00:00:00Z',
          netQuote: -20,
          totalDeals: 0,
          losses: 0,
        },
      }),
      [
        buildCycle(
          {
            id: 80101,
            status: 'STARTED',
            date: openStart,
            netQuote: -20,
            mfeAbsolute: 60,
            maeAbsolute: 50,
          },
          [
            buildOrder({
              createdAt: openStart,
              executedAt: openStart,
            }),
          ],
        ),
      ],
    );

    const tradeStart = '2024-07-05T10:00:00Z';
    const tradeEnd = '2024-07-05T12:00:00Z';
    expect(openMetrics.openPosition?.start).toBe(new Date(openStart).getTime());
    expect(openMetrics.openPosition?.lastUpdate).toBe(new Date(openStart).getTime());

    const finishedMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 802,
          from: tradeStart,
          to: tradeEnd,
          netQuote: 30,
          totalDeals: 1,
          profits: 1,
        },
      }),
      [
        buildCycle(
          {
            id: 80201,
            date: tradeEnd,
            duration: 7200,
            netQuote: 30,
            mfeAbsolute: 65,
            maeAbsolute: 50,
          },
          [
            buildOrder({
              createdAt: tradeStart,
              executedAt: tradeStart,
            }),
            buildOrder({
              createdAt: tradeEnd,
              executedAt: tradeEnd,
            }),
          ],
        ),
      ],
    );

    const summary = summarizeAggregations([openMetrics, finishedMetrics], { maxConcurrentBots: 1 });

    expect(summary.openDeals).toBe(1);
    expect(summary.activeMpu).toBe(50);
    expect(summary.aggregateMPU).toBe(50);
    expect(summary.aggregateRiskSeries.maxValue).toBe(50);
    expect(summary.aggregateWorstRisk).toBe(50);
  });

  it('returns the highest individual MPU when risk intervals do not overlap', () => {
    const metricsA = buildMetricsWithRiskWindow({
      id: 401,
      start: '2024-02-01T00:00:00Z',
      end: '2024-02-01T02:00:00Z',
      mae: 20,
    });

    const metricsB = buildMetricsWithRiskWindow({
      id: 402,
      start: '2024-02-01T03:00:00Z',
      end: '2024-02-01T05:00:00Z',
      mae: 55,
    });

    const metricsC = buildMetricsWithRiskWindow({
      id: 403,
      start: '2024-02-01T06:30:00Z',
      end: '2024-02-01T07:30:00Z',
      mae: 40,
    });

    const summary = summarizeAggregations([metricsA, metricsB, metricsC]);

    expect(summary.aggregateMPU).toBe(55);
    expect(summary.aggregateRiskSeries.maxValue).toBe(55);
    expectRiskEfficiencyConsistency(summary);
  });

  it('sums concurrent risk spikes including instantaneous windows', () => {
    const metricsA = buildMetricsWithRiskWindow({
      id: 451,
      start: '2024-03-01T00:00:00Z',
      end: '2024-03-01T02:00:00Z',
      mae: 12,
    });

    const metricsB = buildMetricsWithRiskWindow({
      id: 452,
      start: '2024-03-01T00:00:00Z',
      end: '2024-03-01T01:00:00Z',
      mae: 18,
    });

    const metricsC = buildMetricsWithRiskWindow({
      id: 453,
      start: '2024-03-01T01:30:00Z',
      end: '2024-03-01T01:30:00Z',
      mae: 10,
    });

    const metricsD = buildMetricsWithRiskWindow({
      id: 454,
      start: '2024-03-01T01:00:00Z',
      end: '2024-03-01T01:00:00Z',
      mae: 8,
    });

    const summary = summarizeAggregations([metricsA, metricsB, metricsC, metricsD]);

    expect(summary.aggregateMPU).toBe(38);
    expect(summary.aggregateRiskSeries.maxValue).toBe(38);
    expectRiskEfficiencyConsistency(summary);
  });

  it('ignores cycles without risk contribution when computing aggregate MPU', () => {
    const metricsA = buildMetricsWithRiskWindow({
      id: 481,
      start: '2024-04-10T00:00:00Z',
      end: '2024-04-10T03:00:00Z',
      mae: 25,
    });

    const zeroRiskMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 482,
          from: '2024-04-11T00:00:00Z',
          to: '2024-04-11T01:00:00Z',
          totalDeals: 1,
          losses: 1,
          avgDuration: 3600,
        },
      }),
      [
        buildCycle({
          id: 482,
          date: '2024-04-11T01:00:00Z',
          duration: 3600,
          maeAbsolute: 0,
        }),
      ],
    );

    const summary = summarizeAggregations([metricsA, zeroRiskMetrics]);

    expect(summary.aggregateMPU).toBe(25);
    expect(summary.aggregateRiskSeries.maxValue).toBe(25);
    expectRiskEfficiencyConsistency(summary);
  });

  it('computes aggregate MPU across overlapping risk intervals', () => {
    const metricsA = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 301,
          netQuote: 0,
          netQuotePerDay: 0,
          totalDeals: 1,
          profits: 0,
          losses: 1,
          avgDuration: 7200,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-03T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 1,
          date: '2024-01-02T01:00:00Z',
          duration: 7200,
          netQuote: 0,
          profitQuote: 0,
          pnl: -5,
          maeAbsolute: -10,
        }),
      ],
    );

    const metricsB = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 302,
          netQuote: 0,
          netQuotePerDay: 0,
          totalDeals: 1,
          profits: 0,
          losses: 1,
          avgDuration: 7200,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-03T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 2,
          date: '2024-01-02T01:30:00Z',
          duration: 7200,
          netQuote: 0,
          profitQuote: 0,
          pnl: -7,
          maeAbsolute: -20,
        }),
      ],
    );

    const summary = summarizeAggregations([metricsA, metricsB]);

    expect(summary.aggregateMPU).toBeCloseTo(30);
    expect(summary.aggregateRiskSeries.maxValue).toBeCloseTo(30);
    expectRiskEfficiencyConsistency(summary);
  });

  it('calculates noTradeDays across sparse activity windows', () => {
    const metrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 550,
          name: 'Sparse Player',
          from: '2024-04-01T00:00:00Z',
          to: '2024-04-04T00:00:00Z',
          netQuote: 5,
          netQuotePerDay: 1.5,
          profits: 2,
          losses: 1,
          totalDeals: 3,
          avgDuration: 3600,
        },
      }),
      [
        buildCycle({
          id: 61,
          date: '2024-04-01T12:00:00Z',
          duration: 3600,
          netQuote: 15,
          mfeAbsolute: 25,
          maeAbsolute: 5,
        }),
        buildCycle({
          id: 62,
          date: '2024-04-03T18:00:00Z',
          duration: 7200,
          netQuote: -10,
          mfeAbsolute: 12,
          maeAbsolute: 8,
        }),
      ],
    );

    const summary = summarizeAggregations([metrics]);

    expect(summary.totalSelected).toBe(1);
    expect(summary.noTradeDays).toBe(1);
    expectRiskEfficiencyConsistency(summary);
  });

  it('includes idle selections when counting noTradeDays', () => {
    const activeMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 610,
          name: 'Active Strategy',
          from: '2024-05-02T00:00:00Z',
          to: '2024-05-04T00:00:00Z',
          netQuote: 40,
          netQuotePerDay: 10,
          profits: 1,
          losses: 0,
          totalDeals: 1,
          avgDuration: 7200,
        },
      }),
      [
        buildCycle({
          id: 71,
          date: '2024-05-02T10:00:00Z',
          duration: 7200,
          netQuote: 40,
          mfeAbsolute: 50,
          maeAbsolute: 5,
        }),
      ],
    );

    const idleMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 620,
          name: 'Idle Extension',
          from: '2024-05-01T00:00:00Z',
          to: '2024-05-06T00:00:00Z',
          netQuote: 0,
          netQuotePerDay: 0,
          profits: 0,
          losses: 0,
          totalDeals: 0,
          avgDuration: 0,
        },
      }),
      [],
    );

    const summary = summarizeAggregations([activeMetrics, idleMetrics]);

    expect(summary.totalSelected).toBe(2);
    expect(summary.noTradeDays).toBe(4);
    expectRiskEfficiencyConsistency(summary);
  });

  it('tracks aggregate drawdown and concurrency across overlapping selections', () => {
    const detailA = buildDetail({
      stats: {
        id: 303,
        name: 'Alpha',
        netQuote: 20,
        netQuotePerDay: 5,
        profits: 2,
        losses: 1,
        totalDeals: 3,
        avgDuration: 3600,
        from: '2024-03-01T00:00:00Z',
        to: '2024-03-04T00:00:00Z',
      },
    });

    const detailB = buildDetail({
      stats: {
        id: 404,
        name: 'Beta',
        netQuote: 20,
        netQuotePerDay: 4,
        profits: 1,
        losses: 2,
        totalDeals: 3,
        avgDuration: 5400,
        from: '2024-03-01T00:00:00Z',
        to: '2024-03-05T00:00:00Z',
      },
    });

    const metricsA = computeBacktestMetrics(detailA, [
      buildCycle({
        id: 31,
        date: '2024-03-01T10:00:00Z',
        duration: 7200,
        netQuote: 100,
        mfeAbsolute: 120,
        maeAbsolute: 40,
      }),
      buildCycle({
        id: 32,
        date: '2024-03-02T02:00:00Z',
        duration: 3600,
        netQuote: -80,
        mfeAbsolute: 30,
        maeAbsolute: 25,
      }),
      buildCycle({
        id: 33,
        status: 'STARTED',
        date: '2024-03-03T06:00:00Z',
        duration: 5400,
        netQuote: 30,
        mfeAbsolute: 15,
        maeAbsolute: 10,
      }),
    ]);

    const metricsB = computeBacktestMetrics(detailB, [
      buildCycle({
        id: 41,
        date: '2024-03-01T10:00:00Z',
        duration: 10_800,
        netQuote: 50,
        mfeAbsolute: 80,
        maeAbsolute: 15,
      }),
      buildCycle({
        id: 42,
        date: '2024-03-02T02:00:00Z',
        duration: 7200,
        netQuote: -10,
        mfeAbsolute: 20,
        maeAbsolute: 35,
      }),
      buildCycle({
        id: 43,
        date: '2024-03-03T20:00:00Z',
        duration: 7200,
        netQuote: -20,
        mfeAbsolute: 15,
        maeAbsolute: 30,
      }),
    ]);

    const summary = summarizeAggregations([metricsA, metricsB]);

    expect(summary.totalSelected).toBe(2);
    expect(summary.totalPnl).toBe(metricsA.pnl + metricsB.pnl);
    expect(summary.aggregateDrawdown).toBe(110);
    expect(summary.maxConcurrent).toBe(2);
    expect(summary.avgConcurrent).toBeGreaterThan(0);
    expect(summary.avgConcurrent).toBeLessThanOrEqual(summary.maxConcurrent);
    expect(summary.noTradeDays).toBe(1);
    expectRiskEfficiencyConsistency(summary);

    const march1Index = Math.floor(new Date('2024-03-01T00:00:00Z').getTime() / MS_IN_DAY);
    const march2Index = Math.floor(new Date('2024-03-02T00:00:00Z').getTime() / MS_IN_DAY);
    const march3Index = Math.floor(new Date('2024-03-03T00:00:00Z').getTime() / MS_IN_DAY);

    expect(summary.dailyConcurrency.records).toHaveLength(3);
    expect(summary.dailyConcurrency.records.map((record) => record.dayIndex)).toEqual([
      march1Index,
      march2Index,
      march3Index,
    ]);

    const march1Record = summary.dailyConcurrency.records[0];
    const march3Record = summary.dailyConcurrency.records[2];

    expect(march1Record.maxCount).toBe(2);
    expect(march3Record.maxCount).toBe(1);
    expect(march1Record.avgActiveCount).toBeGreaterThan(1);

    expect(summary.dailyConcurrency.stats.meanMax).toBeCloseTo(5 / 3, 6);
    expect(summary.dailyConcurrency.stats.p75).toBe(2);
    expect(summary.dailyConcurrency.stats.p90).toBe(2);
    expect(summary.dailyConcurrency.stats.p95).toBe(2);
    expect(summary.dailyConcurrency.stats.limits).toEqual({
      p75: 2,
      p90: 2,
      p95: 2,
    });

    expect(summary.portfolioEquity.points).toHaveLength(6);
    expect(summary.portfolioEquity.points[0].value).toBe(0);
    const lastPoint = summary.portfolioEquity.points[summary.portfolioEquity.points.length - 1];
    expect(lastPoint.value).toBe(40);
    expect(summary.portfolioEquity.minValue).toBeLessThanOrEqual(summary.portfolioEquity.maxValue);
  });

  it('respects concurrency limits by skipping overlapping trades', () => {
    const alphaMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 301,
          name: 'Alpha',
          netQuote: 180,
          netQuotePerDay: 18,
          profits: 3,
          losses: 0,
          totalDeals: 3,
          avgDuration: 7200,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-03T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 1,
          date: '2024-01-01T02:00:00Z',
          duration: 7200,
          netQuote: 100,
        }),
        buildCycle({
          id: 2,
          date: '2024-01-01T04:00:01Z',
          duration: 7200,
          netQuote: 50,
        }),
        buildCycle({
          id: 3,
          date: '2024-01-02T04:00:00Z',
          duration: 3600,
          netQuote: 30,
        }),
      ],
    );

    const betaMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 302,
          name: 'Beta',
          netQuote: 80,
          netQuotePerDay: 8,
          profits: 1,
          losses: 0,
          totalDeals: 1,
          avgDuration: 7200,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-02T00:00:00Z',
        },
      }),
      [
        buildCycle({
          id: 10,
          date: '2024-01-01T03:00:00Z',
          duration: 7200,
          netQuote: 80,
        }),
      ],
    );

    const metricsList = [alphaMetrics, betaMetrics];
    const unlimitedSummary = summarizeAggregations(metricsList);
    const boundedSummary = summarizeAggregations(metricsList, {
      maxConcurrentBots: 1,
    });
    const relaxedSummary = summarizeAggregations(metricsList, {
      maxConcurrentBots: 5,
    });

    expect(relaxedSummary).toEqual(unlimitedSummary);

    expect(unlimitedSummary.aggregateRiskSeries.maxValue).toBe(unlimitedSummary.aggregateMPU);
    expect(boundedSummary.aggregateRiskSeries.maxValue).toBe(boundedSummary.aggregateMPU);
    expect(unlimitedSummary.aggregateRiskSeries.points.length).toBeGreaterThan(0);
    expectRiskEfficiencyConsistency(unlimitedSummary);
    expectRiskEfficiencyConsistency(boundedSummary);
    expectRiskEfficiencyConsistency(relaxedSummary);

    expect(boundedSummary.totalDeals).toBeLessThan(unlimitedSummary.totalDeals);
    expect(boundedSummary.totalPnl).toBeLessThan(unlimitedSummary.totalPnl);
    expect(boundedSummary.totalDeals).toBe(3);
    expect(boundedSummary.totalPnl).toBe(180);
    expect(boundedSummary.totalProfits).toBe(3);
    expect(boundedSummary.totalLosses).toBe(0);
    expect(boundedSummary.maxConcurrent).toBeLessThanOrEqual(1);
    expect(boundedSummary.dailyConcurrency.records.every((record) => record.maxCount <= 1)).toBe(true);
    expect(boundedSummary.noTradeDays).toBeGreaterThanOrEqual(unlimitedSummary.noTradeDays);
    expect(relaxedSummary.noTradeDays).toBe(unlimitedSummary.noTradeDays);
  });

  it('retains open position risk on the aggregate risk chart under concurrency limits', () => {
    const alphaMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 501,
          name: 'Alpha',
          netQuote: 0,
          netQuotePerDay: 0,
          totalDeals: 0,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-05T00:00:00Z',
        },
      }),
      [
        buildCycle(
          {
            id: 8001,
            status: 'FINISHED',
            date: '2024-01-02T04:00:00Z',
            duration: 7200,
            netQuote: 40,
            maeAbsolute: 5,
          },
          [
            buildOrder({
              createdAt: '2024-01-02T02:00:00Z',
              executedAt: '2024-01-02T02:00:01Z',
            }),
            buildOrder({
              createdAt: '2024-01-02T03:59:00Z',
              executedAt: '2024-01-02T04:00:00Z',
            }),
          ],
        ),
        buildCycle(
          {
            id: 9001,
            status: 'STARTED',
            date: '2024-01-04T12:00:00Z',
            maeAbsolute: 25,
            netQuote: -5,
          },
          [
            buildOrder({
              createdAt: '2024-01-04T00:00:00Z',
              executedAt: '2024-01-04T00:00:01Z',
            }),
          ],
        ),
      ],
    );

    const betaMetrics = computeBacktestMetrics(
      buildDetail({
        stats: {
          id: 502,
          name: 'Beta',
          netQuote: 0,
          netQuotePerDay: 0,
          totalDeals: 0,
          from: '2024-01-01T00:00:00Z',
          to: '2024-01-05T00:00:00Z',
        },
      }),
      [
        buildCycle(
          {
            id: 8002,
            status: 'FINISHED',
            date: '2024-01-02T05:00:00Z',
            duration: 7200,
            netQuote: 30,
            maeAbsolute: 8,
          },
          [
            buildOrder({
              createdAt: '2024-01-02T03:00:00Z',
              executedAt: '2024-01-02T03:00:01Z',
            }),
            buildOrder({
              createdAt: '2024-01-02T04:59:00Z',
              executedAt: '2024-01-02T05:00:00Z',
            }),
          ],
        ),
        buildCycle(
          {
            id: 9002,
            status: 'STARTED',
            date: '2024-01-04T16:00:00Z',
            maeAbsolute: 10,
            netQuote: -2,
          },
          [
            buildOrder({
              createdAt: '2024-01-04T06:00:00Z',
              executedAt: '2024-01-04T06:00:01Z',
            }),
          ],
        ),
      ],
    );

    expect(alphaMetrics.activeMpu).toBe(25);
    expect(betaMetrics.activeMpu).toBe(10);
    expect(alphaMetrics.concurrencyIntervals.length).toBeGreaterThan(0);
    expect(betaMetrics.concurrencyIntervals.length).toBeGreaterThan(0);
    expect(alphaMetrics.concurrencyIntervals[0].start).toBeLessThan(alphaMetrics.concurrencyIntervals[0].end);
    expect(betaMetrics.concurrencyIntervals[0].start).toBeLessThan(betaMetrics.concurrencyIntervals[0].end);

    const unlimitedSummary = summarizeAggregations([alphaMetrics, betaMetrics]);
    expect(unlimitedSummary.activeMpu).toBe(35);

    const limitedSummary = summarizeAggregations([alphaMetrics, betaMetrics], {
      maxConcurrentBots: 1,
    });

    expect(limitedSummary.activeMpu).toBe(25);
    expect(limitedSummary.maxConcurrent).toBeLessThanOrEqual(1);
    expect(limitedSummary.aggregateRiskSeries.points.length).toBeGreaterThan(0);
    const hasOpenRiskPoint = limitedSummary.aggregateRiskSeries.points.some((point) => point.value === 25);
    expect(hasOpenRiskPoint).toBe(true);
    expect(limitedSummary.aggregateRiskSeries.maxValue).toBe(25);
    expect(limitedSummary.aggregateMPU).toBe(25);
  });
});
