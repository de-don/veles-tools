import { calculateMaxDrawdown } from '../lib/backtestAnalytics';
import { MS_IN_DAY, toTimestamp } from '../lib/dateTime';
import type { BacktestInfo, BacktestInfoDeal } from '../types/backtestInfos';
import type { BacktestCycle, BacktestDetail } from '../types/backtests';

const calculateAverageDurationDays = (deals: BacktestInfoDeal[]): number => {
  if (deals.length === 0) {
    return 0;
  }
  const totalMs = deals.reduce((sum, deal) => sum + (deal.end - deal.start), 0);
  return totalMs / deals.length / MS_IN_DAY;
};

const collectTradingDays = (deals: BacktestInfoDeal[]): number => {
  if (deals.length === 0) {
    return 0;
  }

  const days = new Set<string>();
  deals.forEach((deal) => {
    for (let cursor = deal.startDay.getTime(); cursor <= deal.endDay.getTime(); cursor += MS_IN_DAY) {
      days.add(new Date(cursor).toISOString().slice(0, 10));
    }
  });

  return days.size;
};

const calculateWinRatePercent = (profits: number, losses: number): number | null => {
  const total = profits + losses;
  if (total === 0) {
    return null;
  }
  return (profits / total) * 100;
};

// TODO: here we can just check last cycle, and if it has status STARTED return it
const getLatestStartedCycle = (cycles: BacktestCycle[]): BacktestCycle | null => {
  let latestCycle: BacktestCycle | null = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  cycles.forEach((cycle) => {
    if (cycle.status !== 'STARTED') {
      return;
    }
    const timestamp = toTimestamp(cycle.date) ?? Number.NEGATIVE_INFINITY;
    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
      latestCycle = cycle;
    }
  });

  return latestCycle;
};

const calculateExtremes = (values: number[]): { max: number; avg: number } => {
  if (values.length === 0) {
    return { max: 0, avg: 0 };
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return {
    max: Math.max(...values),
    avg: sum / values.length,
  };
};

const sortCyclesByDate = (cycles: BacktestCycle[]): BacktestCycle[] => {
  return [...cycles].sort((left, right) => {
    const leftTime = toTimestamp(left.date) ?? Number.MAX_SAFE_INTEGER;
    const rightTime = toTimestamp(right.date) ?? Number.MAX_SAFE_INTEGER;
    if (leftTime === rightTime) {
      return left.id - right.id;
    }
    return leftTime - rightTime;
  });
};

const buildEquitySeries = (cycles: BacktestCycle[]): number[] => {
  const sorted = sortCyclesByDate(cycles);
  const series: number[] = [0];
  let cumulative = 0;

  sorted.forEach((cycle) => {
    const pnl = cycle.pnl;
    cumulative += pnl ?? 0;
    series.push(cumulative);
  });

  return series;
};

export const buildBacktestInfo = (detail: BacktestDetail, cycles: BacktestCycle[]): BacktestInfo => {
  const { statistics, config } = detail;

  const deals = cycles.map((cycle) => {
    // biome-ignore lint/style/noNonNullAssertion: one order is guaranteed to exist
    const startTime = Date.parse(cycle.orders.at(0)!.createdAt);
    const startDay = new Date(startTime);
    startDay.setHours(0, 0, 0, 0);

    const endTime = Date.parse(cycle.date);
    const endDay = new Date(endTime);
    endDay.setHours(0, 0, 0, 0);

    const isCompleted = cycle.status !== 'STARTED';

    return {
      id: cycle.id,
      start: startTime,
      end: endTime,
      startDay,
      endDay,
      status: cycle.status,
      net: isCompleted ? (cycle.netQuote ?? 0) : 0,
      maeAbsolute: Math.abs(cycle.maeAbsolute),
      mfeAbsolute: Math.abs(cycle.mfeAbsolute),
      durationInDays: (endTime - startTime) / MS_IN_DAY,
    } satisfies BacktestInfoDeal;
  });

  const averageDurationDays = calculateAverageDurationDays(deals);
  const tradingDays = collectTradingDays(deals);
  const latestStartedCycle = getLatestStartedCycle(cycles);
  const maeStats = calculateExtremes(cycles.map((cycle) => Math.abs(cycle.maeAbsolute)));
  const mfeStats = calculateExtremes(cycles.map((cycle) => Math.abs(cycle.mfeAbsolute)));
  const equitySeries = buildEquitySeries(cycles);
  const maxDrawdownQuote = calculateMaxDrawdown(equitySeries);

  return {
    id: statistics.id,
    name: statistics.name,
    exchange: statistics.exchange,
    symbol: statistics.symbol,
    algorithm: statistics.algorithm,
    base: statistics.base,
    quote: statistics.quote,
    from: statistics.from,
    to: statistics.to,
    depositAmount: config.deposit.amount,
    depositCurrency: statistics.quote,
    leverage: config.deposit.leverage,
    winRatePercent: calculateWinRatePercent(statistics.profits, statistics.losses),
    profitableDeals: statistics.profits,
    losingDeals: statistics.losses,
    profitNet: statistics.netQuote,
    netQuotePerDay: statistics.netQuotePerDay,
    activeMaeAbsolute: latestStartedCycle?.maeAbsolute ?? null,
    averageDurationDays,
    tradingDays,
    maxMaeAbsolute: maeStats.max,
    maxMfeAbsolute: mfeStats.max,
    avgMaeAbsolute: maeStats.avg,
    avgMfeAbsolute: mfeStats.avg,
    maxDrawdownQuote,
    deals,
  };
};
