import { describe, expect, it } from 'vitest';
import {
  MS_IN_DAY,
  computeBacktestMetrics,
  summarizeAggregations,
} from '../backtestAggregation';
import type {
  BacktestCycle,
  BacktestOrder,
  BacktestStatisticsDetail,
} from '../../types/backtests';

const buildDetail = (
  overrides: Partial<BacktestStatisticsDetail> = {},
): BacktestStatisticsDetail => ({
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
  ...overrides,
});

const buildCycle = (
  overrides: Partial<BacktestCycle> = {},
  orders: BacktestOrder[] | null = [],
): BacktestCycle => ({
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
    expect(metrics.concurrencyIntervals).toHaveLength(3);
    expect(metrics.concurrencyIntervals[0].start).toBe(new Date('2024-01-02T22:00:00Z').getTime());
    expect(metrics.concurrencyIntervals[0].end).toBe(new Date('2024-01-03T00:00:00Z').getTime());
    expect(metrics.equityEvents).toHaveLength(3);
    expect(metrics.activeDurationMs).toBe(12_600_000);
    expect(metrics.downtimeDays).toBeCloseTo(8.85, 2);
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
});

describe('summarizeAggregations', () => {
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
    expect(summary.avgNetPerDay).toBeCloseTo((metricsA.avgNetPerDay + metricsB.avgNetPerDay) / summary.totalSelected, 10);
    expect(summary.avgTradeDurationDays).toBeCloseTo(
      (metricsA.totalTradeDurationSec + metricsB.totalTradeDurationSec)
        / summary.totalDeals
        / 86400,
      6,
    );
    expect(summary.avgMaxDrawdown).toBeCloseTo((metricsA.maxDrawdown + metricsB.maxDrawdown) / 2, 6);
    expect(summary.aggregateDrawdown).toBeGreaterThanOrEqual(Math.max(metricsA.maxDrawdown, metricsB.maxDrawdown));
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
});
