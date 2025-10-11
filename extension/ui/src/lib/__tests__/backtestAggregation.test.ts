import { describe, expect, it } from 'vitest';
import type { BacktestCycle, BacktestOrder, BacktestStatisticsDetail } from '../../types/backtests';
import { computeBacktestMetrics, MS_IN_DAY, summarizeAggregations } from '../backtestAggregation';

const buildDetail = (overrides: Partial<BacktestStatisticsDetail> = {}): BacktestStatisticsDetail => ({
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
  winRateProfits: null,
  winRateLosses: null,
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
  deposit: null,
  ...overrides,
});

const buildCycle = (overrides: Partial<BacktestCycle> = {}, orders: BacktestOrder[] | null = []): BacktestCycle => ({
  id: 1,
  status: 'FINISHED',
  date: '2024-01-01T00:00:00Z',
  duration: 0,
  netQuote: 0,
  profitQuote: 0,
  mfeAbsolute: 0,
  maeAbsolute: 0,
  orders,
  ...overrides,
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
      id,
      from: start,
      to: end,
      totalDeals: 1,
      losses: 1,
      avgDuration: durationSec,
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

describe('computeBacktestMetrics', () => {
  it('aggregates statistics and cycles into consistent metrics', () => {
    const stats = buildDetail({
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
      deposit: {
        amount: 2500,
        leverage: 5,
        marginType: 'CROSS',
        currency: 'USDT',
      },
      winRateProfits: 2,
      winRateLosses: 1,
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
        [{ executedAt: '2024-01-02T22:30:00Z' }],
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
        status: 'RUNNING',
        duration: 3600,
        netQuote: 30,
      }),
    ];

    const metrics = computeBacktestMetrics(stats, cycles);

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
    expect(metrics.depositAmount).toBe(2500);
    expect(metrics.depositLeverage).toBe(5);
    expect(metrics.depositCurrency).toBe('USDT');
    expect(metrics.winRatePercent).toBeCloseTo((2 / 3) * 100, 6);
    expect(metrics.concurrencyIntervals).toHaveLength(4);
    expect(metrics.concurrencyIntervals[0].start).toBe(new Date('2024-01-02T22:00:00Z').getTime());
    expect(metrics.concurrencyIntervals[0].end).toBe(new Date('2024-01-03T00:00:00Z').getTime());
    expect(metrics.equityEvents).toHaveLength(3);
    expect(metrics.activeDurationMs).toBe(16_200_000);
    expect(metrics.downtimeDays).toBeCloseTo(8.8125, 4);
    expect(metrics.spanStart).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    expect(metrics.spanEnd).toBe(new Date('2024-01-10T00:00:00Z').getTime());

    const jan2Index = Math.floor(new Date('2024-01-02T00:00:00Z').getTime() / MS_IN_DAY);
    const jan7Index = Math.floor(new Date('2024-01-07T00:00:00Z').getTime() / MS_IN_DAY);
    expect(metrics.activeDayIndices).toContain(jan2Index);
    expect(metrics.activeDayIndices).toContain(jan7Index);
    expect(metrics.trades).toHaveLength(3);
    expect(metrics.trades[0]).toMatchObject({ net: 100, mfe: 120, mae: 25 });
    expect(metrics.trades[1]).toMatchObject({ net: -40, mfe: 10, mae: 0 });
  });

  it('handles incomplete stats ranges and missing cycle durations', () => {
    const stats = buildDetail({
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
      periodStart: '2024-02-01T00:00:00Z',
      periodEnd: '2024-02-04T00:00:00Z',
    });

    const finishedWithOrders = buildCycle(
      {
        id: 501,
        date: '2024-02-02T12:00:00Z',
        duration: null,
        netQuote: 75,
        mfeAbsolute: 50,
        maeAbsolute: -20,
      },
      [{ createdAt: '2024-02-02T08:00:00Z' }, { executedAt: '2024-02-02T09:30:00Z' }],
    );

    const finishedWithoutOrders = buildCycle({
      id: 502,
      date: '2024-02-03T18:00:00Z',
      duration: null,
      netQuote: Number.NaN,
      mfeAbsolute: -5,
      maeAbsolute: 0,
    });

    const runningCycle = buildCycle({
      id: 503,
      status: 'RUNNING',
      date: '2024-02-03T08:00:00Z',
      duration: 3600,
      netQuote: 40,
      mfeAbsolute: 10,
      maeAbsolute: 5,
    });

    const metrics = computeBacktestMetrics(stats, [finishedWithOrders, finishedWithoutOrders, runningCycle]);

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
    expect(metrics.depositAmount).toBeNull();
    expect(metrics.depositLeverage).toBeNull();
    expect(metrics.winRatePercent).toBeCloseTo((3 / 4) * 100, 6);
  });

  it('normalizes textual deposit configuration values', () => {
    const stats = buildDetail({
      id: 909,
      winRateProfits: 5,
      winRateLosses: 5,
      deposit: {
        amount: '1 250,75 USDT' as unknown as number,
        leverage: '10x' as unknown as number,
        marginType: 'ISOLATED',
        currency: null,
      },
      quote: 'USDT',
    });

    const metrics = computeBacktestMetrics(stats, []);

    expect(metrics.depositAmount).toBeCloseTo(1250.75, 6);
    expect(metrics.depositCurrency).toBe('USDT');
    expect(metrics.depositLeverage).toBe(10);
    expect(metrics.winRatePercent).toBe(50);
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
  });

  it('aggregates multiple backtests into portfolio-level metrics', () => {
    const metricsA = computeBacktestMetrics(
      buildDetail({
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
          orders: [{ executedAt: '2024-01-04T05:30:00Z' }],
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
        id: 482,
        from: '2024-04-11T00:00:00Z',
        to: '2024-04-11T01:00:00Z',
        totalDeals: 1,
        losses: 1,
        avgDuration: 3600,
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
  });

  it('computes aggregate MPU across overlapping risk intervals', () => {
    const metricsA = computeBacktestMetrics(
      buildDetail({
        id: 301,
        netQuote: 0,
        netQuotePerDay: 0,
        totalDeals: 1,
        profits: 0,
        losses: 1,
        avgDuration: 7200,
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-03T00:00:00Z',
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
        id: 302,
        netQuote: 0,
        netQuotePerDay: 0,
        totalDeals: 1,
        profits: 0,
        losses: 1,
        avgDuration: 7200,
        from: '2024-01-01T00:00:00Z',
        to: '2024-01-03T00:00:00Z',
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
  });

  it('calculates noTradeDays across sparse activity windows', () => {
    const metrics = computeBacktestMetrics(
      buildDetail({
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
  });

  it('includes idle selections when counting noTradeDays', () => {
    const activeMetrics = computeBacktestMetrics(
      buildDetail({
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
      }),
      [],
    );

    const summary = summarizeAggregations([activeMetrics, idleMetrics]);

    expect(summary.totalSelected).toBe(2);
    expect(summary.noTradeDays).toBe(4);
  });

  it('tracks aggregate drawdown and concurrency across overlapping selections', () => {
    const statsA = buildDetail({
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
    });

    const statsB = buildDetail({
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
    });

    const metricsA = computeBacktestMetrics(statsA, [
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
        status: 'RUNNING',
        date: '2024-03-03T06:00:00Z',
        duration: 5400,
        netQuote: 30,
        mfeAbsolute: 15,
        maeAbsolute: 10,
      }),
    ]);

    const metricsB = computeBacktestMetrics(statsB, [
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
});
