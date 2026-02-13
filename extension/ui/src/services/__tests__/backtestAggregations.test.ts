import { describe, expect, it } from 'vitest';
import { MS_IN_DAY } from '../../lib/dateTime';
import type { BacktestInfo, BacktestInfoDeal } from '../../types/backtestInfos';
import { aggregateBacktestsMetrics, DEFAULT_AGGREGATION_CONFIG } from '../backtestAggregations';

const baseInfo: Omit<BacktestInfo, 'deals'> = {
  id: 0,
  name: 'Backtest',
  exchange: 'BINANCE',
  symbol: 'BTCUSDT',
  algorithm: 'GRID',
  base: 'BTC',
  quote: 'USDT',
  from: '2024-01-01T00:00:00Z',
  to: '2024-01-02T00:00:00Z',
  depositAmount: 100,
  depositCurrency: 'USDT',
  leverage: 3,
  winRatePercent: null,
  profitableDeals: 0,
  losingDeals: 0,
  profitNet: 0,
  netQuotePerDay: 0,
  activeMaeAbsolute: null,
  averageDurationDays: 0,
  maxDurationSeconds: 0,
  tradingDays: 0,
  maxMaeAbsolute: 0,
  maxMfeAbsolute: 0,
  avgMaeAbsolute: 0,
  avgMfeAbsolute: 0,
  maxDrawdownQuote: 0,
  pnlMaeRatio: null,
};

const buildDeal = (
  overrides: Partial<Omit<BacktestInfoDeal, 'id'>> & { id?: string | number } = {},
): BacktestInfoDeal => {
  const start = overrides.start ?? Date.parse('2024-01-01T00:00:00Z');
  const end = overrides.end ?? start + 60 * 60 * 1000;
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const durationInDays = overrides.durationInDays ?? Math.max(0, (end - start) / MS_IN_DAY);
  const resolvedId = overrides.id ?? Math.floor(Math.random() * 100000).toString();
  return {
    id: typeof resolvedId === 'string' ? resolvedId : String(resolvedId),
    start,
    end,
    startDay,
    endDay,
    status: overrides.status ?? 'FINISHED',
    net: overrides.net ?? 0,
    maeAbsolute: overrides.maeAbsolute ?? 0,
    mfeAbsolute: overrides.mfeAbsolute ?? 0,
    durationInDays,
    backtestId: overrides.backtestId ?? 0,
    backtestName: overrides.backtestName ?? 'Backtest',
    quoteCurrency: overrides.quoteCurrency ?? 'USDT',
  } satisfies BacktestInfoDeal;
};

const buildInfo = (overrides: Partial<BacktestInfo> = {}, deals: BacktestInfoDeal[] = [buildDeal()]): BacktestInfo => ({
  ...baseInfo,
  ...overrides,
  deals,
});

const toTimestamp = (value: string): number => Date.parse(value);

describe('aggregateBacktestsMetrics', () => {
  it('aggregates profit, risk and chart series while respecting concurrency limit', () => {
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 1, from: '2024-01-01T00:00:00Z', to: '2024-01-05T00:00:00Z', netQuotePerDay: 5 }, [
        buildDeal({
          id: 101,
          start: Date.parse('2024-01-01T00:00:00Z'),
          end: Date.parse('2024-01-01T06:00:00Z'),
          net: 100,
          maeAbsolute: 50,
        }),
      ]),
      buildInfo({ id: 2, netQuotePerDay: 15 }, [
        buildDeal({
          id: 201,
          start: Date.parse('2024-01-01T01:00:00Z'),
          end: Date.parse('2024-01-01T08:00:00Z'),
          net: 200,
          maeAbsolute: 70,
        }),
      ]),
      buildInfo({ id: 3, netQuotePerDay: 25 }, [
        buildDeal({
          id: 301,
          start: Date.parse('2024-01-01T02:00:00Z'),
          end: Date.parse('2024-01-01T10:00:00Z'),
          net: -150,
          maeAbsolute: 30,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, { maxConcurrentPositions: 2, positionBlocking: false });

    expect(metrics.totalBacktests).toBe(3);
    expect(metrics.totalProfitQuote).toBe(300);
    expect(metrics.totalProfitableDeals).toBe(2);
    expect(metrics.totalLosingDeals).toBe(0);
    expect(metrics.openDeals).toBe(0);
    expect(metrics.averageProfitPerDeal).toBe(150);
    expect(metrics.averageNetPerDay).toBe(75);
    expect(metrics.averageWinRatePercent).toBe(100);
    expect(metrics.maxConcurrentPositions).toBe(2);
    expect(metrics.maxConcurrentMae).toBe(120);
    expect(metrics.maxAggregatedDrawdown).toBe(0);
    expect(metrics.pnlToRisk).toBeCloseTo(2.5);
    expect(metrics.averageDealDurationDays).toBeCloseTo((6 / 24 + 7 / 24) / 2, 5);
    expect(metrics.totalIdleDays).toBe(0.1);

    expect(metrics.pnlSeries).toEqual([
      { date: Date.parse('2024-01-01T06:00:00Z'), value: 100 },
      { date: Date.parse('2024-01-01T08:00:00Z'), value: 300 },
    ]);
    expect(metrics.maeSeries).toEqual([
      { date: Date.parse('2024-01-01T00:00:00Z'), value: 50 },
      { date: Date.parse('2024-01-01T01:00:00Z'), value: 50 },
      { date: Date.parse('2024-01-01T01:00:00Z'), value: 120 },
      { date: Date.parse('2024-01-01T02:00:00Z'), value: 120 },
      { date: Date.parse('2024-01-01T02:00:00Z'), value: 120 },
      { date: Date.parse('2024-01-01T06:00:00Z'), value: 120 },
      { date: Date.parse('2024-01-01T06:00:00Z'), value: 70 },
      { date: Date.parse('2024-01-01T08:00:00Z'), value: 70 },
      { date: Date.parse('2024-01-01T08:00:00Z'), value: 0 },
      { date: Date.parse('2024-01-01T10:00:00Z'), value: 0 },
      { date: Date.parse('2024-01-01T10:00:00Z'), value: 0 },
    ]);
    expect(metrics.activeDealCountSeries.map((point) => point.value)).toEqual([1, 2, 2, 1, 0, 0]);
    expect(metrics.dealTimelineRows.map((row) => row.backtestId)).toEqual([1, 2, 3]);
    expect(metrics.dealTimelineRows[0]?.items[0]).toMatchObject({ id: '101', limitedByConcurrency: false });
  });

  it('marks deals excluded by the concurrency limit in timeline rows', () => {
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 1, name: 'Primary' }, [
        buildDeal({ id: 'p1', start: toTimestamp('2024-01-01T00:00:00Z'), end: toTimestamp('2024-01-01T06:00:00Z') }),
      ]),
      buildInfo({ id: 2, name: 'Overflow' }, [
        buildDeal({
          id: 'o1',
          start: toTimestamp('2024-01-01T01:00:00Z'),
          end: toTimestamp('2024-01-01T03:00:00Z'),
          net: 500,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, { maxConcurrentPositions: 1, positionBlocking: false });

    const overflowRow = metrics.dealTimelineRows.find((row) => row.backtestId === 2);
    expect(overflowRow).toBeDefined();
    expect(overflowRow?.items).toHaveLength(1);
    expect(overflowRow?.items[0]).toMatchObject({ id: 'o1', limitedByConcurrency: true });
    expect(metrics.totalProfitQuote).toBe(0);
  });

  it('counts started deals as active without affecting closed profit', () => {
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 1 }, [
        buildDeal({
          id: 1,
          start: Date.parse('2024-02-01T00:00:00Z'),
          end: Date.parse('2024-02-01T02:00:00Z'),
          net: 50,
        }),
        buildDeal({
          id: 2,
          start: Date.parse('2024-02-02T00:00:00Z'),
          end: Date.parse('2024-02-02T03:00:00Z'),
          status: 'STARTED',
          maeAbsolute: 25,
          net: -10,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, { maxConcurrentPositions: 1, positionBlocking: false });

    expect(metrics.totalProfitQuote).toBe(50);
    expect(metrics.totalProfitableDeals).toBe(1);
    expect(metrics.totalLosingDeals).toBe(0);
    expect(metrics.openDeals).toBeGreaterThanOrEqual(1);
    expect(metrics.maxConcurrentPositions).toBe(1);
    expect(metrics.pnlSeries).toEqual([{ date: Date.parse('2024-02-01T02:00:00Z'), value: 50 }]);
  });

  it('returns zeros when there are no backtests', () => {
    const metrics = aggregateBacktestsMetrics([], DEFAULT_AGGREGATION_CONFIG);
    expect(metrics.totalBacktests).toBe(0);
    expect(metrics.totalProfitQuote).toBe(0);
    expect(metrics.averageProfitPerDeal).toBe(0);
    expect(metrics.averageNetPerDay).toBe(0);
    expect(metrics.averageWinRatePercent).toBeNull();
    expect(metrics.totalProfitableDeals).toBe(0);
    expect(metrics.totalLosingDeals).toBe(0);
    expect(metrics.openDeals).toBe(0);
    expect(metrics.maxConcurrentPositions).toBe(0);
    expect(metrics.pnlToRisk).toBe(0);
    expect(metrics.maeSeries).toEqual([]);
    expect(metrics.pnlSeries).toEqual([]);
    expect(metrics.activeDealCountSeries).toEqual([]);
    expect(metrics.dealTimelineRows).toEqual([]);
  });

  it('calculates drawdown, risk ratio, and concurrency stats for overlapping deals', () => {
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 1, from: '2024-03-01T00:00:00Z', to: '2024-03-05T00:00:00Z', netQuotePerDay: 10 }, [
        buildDeal({
          id: 501,
          start: toTimestamp('2024-03-01T00:00:00Z'),
          end: toTimestamp('2024-03-02T00:00:00Z'),
          net: 300,
          maeAbsolute: 60,
        }),
        buildDeal({
          id: 502,
          start: toTimestamp('2024-03-03T00:00:00Z'),
          end: toTimestamp('2024-03-04T00:00:00Z'),
          net: -50,
          maeAbsolute: 30,
        }),
      ]),
      buildInfo({ id: 2, netQuotePerDay: -5 }, [
        buildDeal({
          id: 601,
          start: toTimestamp('2024-03-02T12:00:00Z'),
          end: toTimestamp('2024-03-04T12:00:00Z'),
          net: -30,
          maeAbsolute: 70,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, { maxConcurrentPositions: 3, positionBlocking: false });

    expect(metrics.totalProfitQuote).toBe(220);
    expect(metrics.averageNetPerDay).toBe(3.4375);
    expect(metrics.maxAggregatedDrawdown).toBe(80);
    expect(metrics.maxConcurrentMae).toBe(100);
    expect(metrics.pnlToRisk).toBeCloseTo(2.2, 5);
    expect(metrics.averageDealDurationDays).toBeCloseTo(4 / 3, 5);
    expect(metrics.maeSeries.some((point) => point.value === 100)).toBe(true);
    expect(metrics.activeDealCountSeries.some((point) => point.value === 2)).toBe(true);
    expect(metrics.pnlSeries).toEqual([
      { date: toTimestamp('2024-03-02T00:00:00Z'), value: 300 },
      { date: toTimestamp('2024-03-04T00:00:00Z'), value: 250 },
      { date: toTimestamp('2024-03-04T12:00:00Z'), value: 220 },
    ]);
  });

  it('counts open deals risk and idle days correctly', () => {
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 10, from: '2024-04-01T00:00:00Z', to: '2024-04-06T00:00:00Z', netQuotePerDay: 20 }, [
        buildDeal({
          id: 701,
          start: toTimestamp('2024-04-01T02:00:00Z'),
          end: toTimestamp('2024-04-01T05:00:00Z'),
          net: 40,
          maeAbsolute: 10,
        }),
        buildDeal({
          id: 702,
          start: toTimestamp('2024-04-05T10:00:00Z'),
          end: toTimestamp('2024-04-05T12:00:00Z'),
          status: 'STARTED',
          net: -15,
          maeAbsolute: 25,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, { maxConcurrentPositions: 1, positionBlocking: false });

    expect(metrics.totalProfitQuote).toBe(40);
    expect(metrics.totalProfitableDeals).toBe(1);
    expect(metrics.openDeals).toBe(1);
    expect(metrics.aggregatedActiveMae).toBe(25);
    expect(metrics.totalIdleDays).toBe(4.2);
    expect(metrics.pnlSeries).toEqual([{ date: toTimestamp('2024-04-01T05:00:00Z'), value: 40 }]);
  });

  it('tracks metrics when only started deals are present', () => {
    const startedDealStart = toTimestamp('2024-05-01T00:00:00Z');
    const startedDealEnd = toTimestamp('2024-05-01T12:00:00Z');
    const backtests: BacktestInfo[] = [
      buildInfo({ id: 11, from: '2024-05-01T00:00:00Z', to: '2024-05-02T00:00:00Z', netQuotePerDay: 0 }, [
        buildDeal({
          id: 801,
          start: startedDealStart,
          end: startedDealEnd,
          status: 'STARTED',
          net: 0,
          maeAbsolute: 80,
        }),
      ]),
    ];

    const metrics = aggregateBacktestsMetrics(backtests, DEFAULT_AGGREGATION_CONFIG);

    expect(metrics.totalProfitQuote).toBe(0);
    expect(metrics.pnlSeries).toEqual([]);
    expect(metrics.openDeals).toBe(1);
    expect(metrics.aggregatedActiveMae).toBe(80);
    expect(metrics.maxConcurrentMae).toBe(80);
    expect(metrics.maxConcurrentPositions).toBe(1);
    expect(metrics.averageDealDurationDays).toBeCloseTo((startedDealEnd - startedDealStart) / MS_IN_DAY, 5);
    expect(metrics.maeSeries).toEqual([
      { date: startedDealStart, value: 80 },
      { date: startedDealEnd, value: 80 },
      { date: startedDealEnd, value: 80 },
    ]);
    expect(metrics.activeDealCountSeries).toEqual([
      { date: startedDealStart, value: 1 },
      { date: startedDealEnd, value: 1 },
    ]);
  });

  it('does not duplicate active deal counts when multiple deals share identical time points', () => {
    const start = toTimestamp('2024-06-01T00:00:00Z');
    const end = toTimestamp('2024-06-01T12:00:00Z');
    const deals = [
      buildDeal({ id: 901, start, end, maeAbsolute: 10 }),
      buildDeal({ id: 902, start, end, maeAbsolute: 20 }),
    ];

    const metrics = aggregateBacktestsMetrics([buildInfo({ id: 12 }, deals)], {
      maxConcurrentPositions: 3,
      positionBlocking: false,
    });

    const uniqueDates = new Set(metrics.activeDealCountSeries.map((point) => point.date));
    expect(metrics.activeDealCountSeries).toHaveLength(uniqueDates.size);
    expect(metrics.activeDealCountSeries[0]).toEqual({ date: start, value: 2 });
    expect(metrics.activeDealCountSeries.at(-1)).toEqual({ date: end, value: 0 });
    expect(metrics.maxConcurrentPositions).toBe(2);
  });
});
