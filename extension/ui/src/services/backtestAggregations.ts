import { calculateMaxDrawdown } from '../lib/backtestAnalytics';
import { MS_IN_DAY } from '../lib/dateTime';
import type { AggregatedBacktestsMetrics, AggregationConfig, ChartPoint } from '../types/backtestAggregations';
import type { BacktestInfo, BacktestInfoDeal } from '../types/backtestInfos';

export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  maxConcurrentPositions: 3,
};

const sum = (values: number[]): number => {
  return values.reduce((total, value) => total + value, 0);
};

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
};

export const aggregateBacktestsMetrics = (
  backtests: BacktestInfo[],
  config: AggregationConfig,
): AggregatedBacktestsMetrics => {
  if (backtests.length === 0) {
    return {
      totalBacktests: 0,
      totalProfitQuote: 0,
      maxConcurrentPositions: 0,
      averageProfitPerDeal: 0,
      averageNetPerDay: 0,
      averageWinRatePercent: null,
      pnlToRisk: 0,
      totalProfitableDeals: 0,
      totalLosingDeals: 0,
      openDeals: 0,
      aggregatedActiveMae: 0,
      averageDealDurationDays: 0,
      totalIdleDays: 0,
      maxAggregatedDrawdown: 0,
      maxConcurrentMae: 0,
      maeSeries: [],
      pnlSeries: [],
      activeDealCountSeries: [],
    };
  }

  const limit = Math.max(1, config.maxConcurrentPositions);

  const allSortedDeals = backtests.flatMap((info) => info.deals).sort((a, b) => a.start - b.start);

  // TODO: Add start & end of backtest periods from all backtests
  const timePointsAll = allSortedDeals.flatMap((deal) => [deal.start, deal.end]);
  const timePoints = [...new Set(timePointsAll)].sort((a, b) => a - b);

  const aggregatedStats = {
    totalNet: 0,
    maxConcurrentPositions: 0,
    deals: {
      profit: 0,
      loss: 0,
      active: 0,
    },
    activeMae: 0,
    maeSeries: [] as ChartPoint[],
    pnlSeries: [] as ChartPoint[],
    activeDealCountSeries: [] as ChartPoint[],
  };

  const sortedDealsCopy = [...allSortedDeals];
  const activeDeals: BacktestInfoDeal[] = [];
  const dealsResults: Array<{ deal: BacktestInfoDeal; used: boolean }> = [];
  for (let timePointIndex = 0; timePointIndex < timePoints.length; timePointIndex++) {
    const timePoint = timePoints[timePointIndex];
    const nextTimePoint = timePoints[timePointIndex + 1] || null;

    // Look for active deals that end at this particular time point
    for (let i = activeDeals.length - 1; i >= 0; i--) {
      if (activeDeals[i].end !== timePoint) {
        // Deal is still active, leave it in activeDeals
        continue;
      }

      // STARTED deals are not finished yet
      if (activeDeals[i].status === 'STARTED') {
        // Deal is not finished at the moment of backtest end, so we keep it as active until the end
        aggregatedStats.deals.active += 1;
        aggregatedStats.activeMae += activeDeals[i].maeAbsolute;
        continue;
      }

      const closedDeal = activeDeals[i];
      activeDeals.splice(i, 1);

      // Update aggregated statistics
      aggregatedStats.totalNet += closedDeal.net;
      aggregatedStats.pnlSeries.push({ date: timePoint, value: aggregatedStats.totalNet });
      if (closedDeal.net >= 0) {
        aggregatedStats.deals.profit += 1;
      } else {
        aggregatedStats.deals.loss += 1;
      }
    }

    // Look for new deals that start at the current time point and add them to activeDeals (and remove from allSortedDealsCopy)
    while (sortedDealsCopy.at(0)?.start === timePoint) {
      // biome-ignore lint/style/noNonNullAssertion: checked above
      const potentialDeal = sortedDealsCopy.shift()!;

      if (activeDeals.length < limit) {
        activeDeals.push(potentialDeal);
        dealsResults.push({ deal: potentialDeal, used: true });
      } else {
        dealsResults.push({ deal: potentialDeal, used: false });
      }
    }

    // Update max concurrent positions
    aggregatedStats.maxConcurrentPositions = Math.max(aggregatedStats.maxConcurrentPositions, activeDeals.length);

    const sumMae = sum(activeDeals.map((d) => d.maeAbsolute));
    aggregatedStats.maeSeries.push({ date: timePoint, value: sumMae });
    if (nextTimePoint) {
      aggregatedStats.maeSeries.push({ date: nextTimePoint, value: sumMae });
    }

    aggregatedStats.activeDealCountSeries.push({ date: timePoint, value: activeDeals.length });
  }

  const usedDeals = dealsResults.filter((result) => result.used).map((result) => result.deal);

  const totalProfitQuote = aggregatedStats.totalNet;
  const totalProfitableDeals = aggregatedStats.deals.profit;
  const totalLosingDeals = aggregatedStats.deals.loss;
  const totalDeals = aggregatedStats.deals.profit + aggregatedStats.deals.loss + aggregatedStats.deals.active;
  const openDeals = aggregatedStats.deals.active;
  const maxConcurrentPositions = aggregatedStats.maxConcurrentPositions;
  const maxConcurrentMae = aggregatedStats.maeSeries.reduce((max, point) => Math.max(max, point.value), 0);
  const maxAggregatedDrawdown = calculateMaxDrawdown(aggregatedStats.pnlSeries.map((point) => point.value));
  const averageDealDurationDays = average(usedDeals.map((result) => result.durationInDays));

  const backtestPeriodInDays = Math.floor(
    (new Date(backtests[0].to).getTime() - new Date(backtests[0].from).getTime()) / MS_IN_DAY,
  ); // TODO: calculate across all backtests
  const totalTradingDays = new Set(
    usedDeals.flatMap((d) => getDaysRange(d.startDay, d.endDay).map((day) => day.toDateString())),
  ).size;

  const averageNetPerDay = average(backtests.map((b) => b.netQuotePerDay));
  const pnlToRisk = totalProfitQuote / Math.max(1, Math.max(maxConcurrentMae, maxAggregatedDrawdown));

  return {
    totalBacktests: backtests.length,
    totalProfitQuote,
    maxConcurrentPositions,
    averageProfitPerDeal: totalProfitQuote / Math.max(1, totalDeals),
    averageNetPerDay,
    averageWinRatePercent: totalDeals > 0 ? (totalProfitableDeals / totalDeals) * 100 : null,
    pnlToRisk,
    totalProfitableDeals,
    totalLosingDeals,
    openDeals,
    aggregatedActiveMae: aggregatedStats.activeMae,
    averageDealDurationDays,
    totalIdleDays: Math.max(0, backtestPeriodInDays - totalTradingDays),
    maxAggregatedDrawdown: maxAggregatedDrawdown,
    maxConcurrentMae,

    // Series
    maeSeries: aggregatedStats.maeSeries,
    pnlSeries: aggregatedStats.pnlSeries,
    activeDealCountSeries: aggregatedStats.activeDealCountSeries,
  };
};

const getDaysRange = (startDay: Date, endDay: Date): Date[] => {
  const days = [];

  const day = new Date(startDay);
  while (day <= endDay) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  return days;
};
