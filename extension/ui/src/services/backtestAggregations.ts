import { calculateMaxDrawdown } from '../lib/backtestAnalytics';
import { MS_IN_DAY } from '../lib/dateTime';
import {
  type DealInclusionStatus,
  filterDealByPeriod,
  shouldCountInPnl,
  shouldShowOnCharts,
} from '../lib/dealFiltering';
import type {
  AggregatedBacktestsMetrics,
  AggregationConfig,
  ChartPoint,
  DealTimelineRow,
} from '../types/backtestAggregations';
import type { BacktestInfo, BacktestInfoDeal } from '../types/backtestInfos';

export const DEFAULT_AGGREGATION_CONFIG: AggregationConfig = {
  maxConcurrentPositions: 3,
  positionBlocking: false,
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

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

type AggregatedDeal = BacktestInfoDeal & {
  filterStatus: DealInclusionStatus;
  effectiveStart: number;
  effectiveEnd: number;
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
      dealTimelineRows: [],
    };
  }

  const limit = Math.max(1, config.maxConcurrentPositions);
  const positionBlocking = config.positionBlocking;
  const fallbackBacktestStart = Math.min(...backtests.map((b) => new Date(b.from).getTime()));
  const fallbackBacktestEnd = Math.max(...backtests.map((b) => new Date(b.to).getTime()));
  const dealStarts = backtests.flatMap((backtest) => backtest.deals.map((deal) => deal.start));
  const dealEnds = backtests.flatMap((backtest) => backtest.deals.map((deal) => deal.end));
  const fallbackDealStart = dealStarts.length > 0 ? Math.min(...dealStarts) : fallbackBacktestStart;
  const fallbackDealEnd = dealEnds.length > 0 ? Math.max(...dealEnds) : fallbackBacktestEnd;
  const fallbackPeriodStart = Math.min(fallbackBacktestStart, fallbackDealStart);
  const fallbackPeriodEnd = Math.max(fallbackBacktestEnd, fallbackDealEnd);
  const configuredPeriodStart = config.dateRangeStart ?? fallbackPeriodStart;
  const configuredPeriodEnd = config.dateRangeEnd ?? fallbackPeriodEnd;
  const periodStart = Math.min(configuredPeriodStart, configuredPeriodEnd);
  const periodEnd = Math.max(configuredPeriodStart, configuredPeriodEnd);

  const backtestLookup = new Map(
    backtests.map((bt) => [bt.id, { symbol: bt.symbol, algorithm: bt.algorithm }] as const),
  );

  const allSortedDeals: AggregatedDeal[] = backtests
    .flatMap((info) =>
      info.deals.flatMap((deal): AggregatedDeal[] => {
        const filterStatus = filterDealByPeriod(deal, periodStart, periodEnd);
        if (!shouldShowOnCharts(filterStatus)) {
          return [];
        }
        return [
          {
            ...deal,
            filterStatus,
            effectiveStart: Math.max(deal.start, periodStart),
            effectiveEnd: Math.min(deal.end, periodEnd),
            backtestId: info.id,
            backtestName: info.name,
            quoteCurrency: info.quote,
          },
        ];
      }),
    )
    .sort((a, b) => a.effectiveStart - b.effectiveStart || a.start - b.start);

  const timePointsAll = allSortedDeals.flatMap((deal) => [deal.effectiveStart, deal.effectiveEnd]);
  const timePoints = [...new Set(timePointsAll)].sort((a, b) => a - b);

  const aggregatedStats = {
    totalNet: 0,
    maxConcurrentPositions: 0,
    deals: {
      profit: 0,
      loss: 0,
      active: 0,
    },
    idleTime: 0,
    activeMae: 0,
    maeSeries: [] as ChartPoint[],
    pnlSeries: [] as ChartPoint[],
    activeDealCountSeries: [] as ChartPoint[],
  };

  const sortedDealsCopy = [...allSortedDeals];
  const activeDeals: AggregatedDeal[] = [];
  const dealsResults: Array<{ deal: AggregatedDeal; used: boolean }> = [];
  const closeFinishedDeals = (timePoint: number): void => {
    for (let i = activeDeals.length - 1; i >= 0; i--) {
      const deal = activeDeals[i];
      if (deal.effectiveEnd !== timePoint) {
        continue;
      }
      if (deal.status === 'STARTED') {
        continue;
      }
      const closedDeal = activeDeals.splice(i, 1)[0];
      if (shouldCountInPnl(closedDeal.filterStatus)) {
        aggregatedStats.totalNet += closedDeal.net;
        aggregatedStats.pnlSeries.push({ date: timePoint, value: aggregatedStats.totalNet });
        if (closedDeal.net >= 0) {
          aggregatedStats.deals.profit += 1;
        } else {
          aggregatedStats.deals.loss += 1;
        }
      }
    }
  };

  for (let timePointIndex = 0; timePointIndex < timePoints.length; timePointIndex++) {
    const timePoint = timePoints[timePointIndex];
    const nextTimePoint = timePoints[timePointIndex + 1] || null;

    closeFinishedDeals(timePoint);

    while (sortedDealsCopy.at(0)?.effectiveStart === timePoint) {
      const potentialDeal = sortedDealsCopy.shift();
      if (!potentialDeal) {
        break;
      }

      let blocked = activeDeals.length >= limit;

      if (!blocked && positionBlocking) {
        const potentialInfo = backtestLookup.get(potentialDeal.backtestId);
        if (potentialInfo) {
          blocked = activeDeals.some((activeDeal) => {
            const activeInfo = backtestLookup.get(activeDeal.backtestId);
            return activeInfo?.symbol === potentialInfo.symbol && activeInfo?.algorithm === potentialInfo.algorithm;
          });
        }
      }

      if (!blocked) {
        activeDeals.push(potentialDeal);
        dealsResults.push({ deal: potentialDeal, used: true });
      } else {
        dealsResults.push({ deal: potentialDeal, used: false });
      }
    }

    closeFinishedDeals(timePoint);

    aggregatedStats.maxConcurrentPositions = Math.max(aggregatedStats.maxConcurrentPositions, activeDeals.length);

    const sumMae = sum(activeDeals.map((entry) => entry.maeAbsolute));
    aggregatedStats.maeSeries.push({ date: timePoint, value: sumMae });
    if (nextTimePoint) {
      aggregatedStats.maeSeries.push({ date: nextTimePoint, value: sumMae });
    }

    aggregatedStats.activeDealCountSeries.push({ date: timePoint, value: activeDeals.length });

    if (!activeDeals.length && nextTimePoint) {
      aggregatedStats.idleTime += nextTimePoint - timePoint;
    }
  }

  activeDeals.forEach((deal) => {
    if (deal.status === 'STARTED') {
      aggregatedStats.deals.active += 1;
      aggregatedStats.activeMae += deal.maeAbsolute;
    }
  });

  const usedDeals = dealsResults.filter((result) => result.used).map((result) => result.deal);

  const dealTimelineRows: DealTimelineRow[] = backtests.map((info) => ({
    backtestId: info.id,
    backtestName: info.name,
    quoteCurrency: info.quote,
    items: [],
  }));
  const timelineRowsById = new Map(dealTimelineRows.map((row) => [row.backtestId, row] as const));
  dealsResults.forEach(({ deal, used }) => {
    const row = timelineRowsById.get(deal.backtestId);
    if (!row) {
      return;
    }
    row.items.push({
      id: deal.id,
      start: deal.start,
      end: deal.end,
      net: shouldCountInPnl(deal.filterStatus) ? deal.net : 0,
      status: deal.status,
      limitedByConcurrency: !used,
      filterStatus: deal.filterStatus,
    });
  });

  const totalProfitQuote = aggregatedStats.totalNet;
  const totalProfitableDeals = aggregatedStats.deals.profit;
  const totalLosingDeals = aggregatedStats.deals.loss;
  const totalDeals = totalProfitableDeals + totalLosingDeals + aggregatedStats.deals.active;
  const openDeals = aggregatedStats.deals.active;
  const maxConcurrentPositions = aggregatedStats.maxConcurrentPositions;
  const maxConcurrentMae = aggregatedStats.maeSeries.reduce((max, point) => Math.max(max, point.value), 0);
  const maxAggregatedDrawdown = calculateMaxDrawdown(aggregatedStats.pnlSeries.map((point) => point.value));
  const averageDealDurationDays = average(usedDeals.map((result) => result.durationInDays));

  const totalDays = (periodEnd - periodStart) / MS_IN_DAY;

  const averageNetPerDay = totalProfitQuote / Math.max(1, totalDays);
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
    totalIdleDays: round(aggregatedStats.idleTime / MS_IN_DAY, 1),
    maxAggregatedDrawdown: maxAggregatedDrawdown,
    maxConcurrentMae,

    // Series
    maeSeries: aggregatedStats.maeSeries,
    pnlSeries: aggregatedStats.pnlSeries,
    activeDealCountSeries: aggregatedStats.activeDealCountSeries,
    dealTimelineRows,
  };
};
