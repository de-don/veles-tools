import type { BacktestCycle, BacktestStatisticsDetail } from '../types/backtests';

export const MS_IN_DAY = 24 * 60 * 60 * 1000;

export interface TimeInterval {
  start: number;
  end: number;
}

export interface RiskInterval extends TimeInterval {
  value: number;
}

interface CycleInterval {
  cycle: BacktestCycle;
  interval: TimeInterval;
}

export interface EquityEvent {
  time: number;
  delta: number;
  cumulative: number;
  drawdown: number;
}

export interface AggregationTrade {
  id: number;
  start: number;
  end: number;
  net: number;
  mfe: number;
  mae: number;
}

export interface BacktestAggregationMetrics {
  id: number;
  name: string;
  symbol: string;
  pnl: number;
  profitsCount: number;
  lossesCount: number;
  totalDeals: number;
  avgTradeDurationDays: number;
  totalTradeDurationSec: number;
  avgNetPerDay: number;
  maxDrawdown: number;
  maxMPU: number;
  maxMPP: number;
  downtimeDays: number;
  spanStart: number | null;
  spanEnd: number | null;
  activeDurationMs: number;
  equityEvents: EquityEvent[];
  concurrencyIntervals: TimeInterval[];
  riskIntervals: RiskInterval[];
  activeDayIndices: number[];
  trades: AggregationTrade[];
}

export interface DailyConcurrencyRecord {
  dayIndex: number;
  dayStartMs: number;
  activeDurationMs: number;
  maxCount: number;
  avgActiveCount: number;
}

export interface PortfolioEquityPoint {
  time: number;
  value: number;
}

export interface PortfolioEquitySeries {
  points: PortfolioEquityPoint[];
  minValue: number;
  maxValue: number;
}

export interface DailyConcurrencyStats {
  meanMax: number;
  p75: number;
  p90: number;
  p95: number;
  limits: {
    p75: number;
    p90: number;
    p95: number;
  };
}

export interface DailyConcurrencyResult {
  records: DailyConcurrencyRecord[];
  stats: DailyConcurrencyStats;
}

export interface AggregationSummary {
  totalSelected: number;
  totalPnl: number;
  totalProfits: number;
  totalLosses: number;
  totalDeals: number;
  avgPnlPerDeal: number;
  avgPnlPerBacktest: number;
  avgNetPerDay: number;
  avgTradeDurationDays: number;
  avgMaxDrawdown: number;
  aggregateDrawdown: number;
  maxConcurrent: number;
  avgConcurrent: number;
  noTradeDays: number;
  dailyConcurrency: DailyConcurrencyResult;
  portfolioEquity: PortfolioEquitySeries;
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NaN;
};

const parseTimestamp = (value: unknown): number | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value as string);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};

const resolveStatsSpan = (stats: BacktestStatisticsDetail): TimeInterval | null => {
  const startCandidates: Array<string | null | undefined> = [
    stats.from,
    stats.start,
    stats.periodStart,
    stats.dateFrom,
    stats.date_from,
    stats.range?.from ?? null,
    stats.period?.from ?? null,
    stats.period?.start ?? null,
  ];
  const endCandidates: Array<string | null | undefined> = [
    stats.to,
    stats.end,
    stats.periodEnd,
    stats.dateTo,
    stats.date_to,
    stats.range?.to ?? null,
    stats.period?.to ?? null,
    stats.period?.end ?? null,
  ];

  const start = startCandidates
    .map((candidate) => parseTimestamp(candidate ?? null))
    .find(isFiniteNumber);
  const end = endCandidates
    .map((candidate) => parseTimestamp(candidate ?? null))
    .find(isFiniteNumber);

  if (start !== undefined && end !== undefined && end > start) {
    return { start, end };
  }

  return null;
};

const normalizeStatus = (status: string | null | undefined): string => {
  return typeof status === 'string' ? status.toUpperCase() : '';
};

const isFinishedCycle = (cycle: BacktestCycle | null | undefined): cycle is BacktestCycle => {
  return Boolean(cycle && normalizeStatus(cycle.status) === 'FINISHED');
};

const resolveCycleInterval = (cycle: BacktestCycle): TimeInterval | null => {
  const end = parseTimestamp(cycle.date);
  if (!Number.isFinite(end)) {
    return null;
  }

  const durationSec = toNumber(cycle.duration);
  let start = Number.isFinite(durationSec) ? Number(end) - durationSec * 1000 : Number.NaN;

  if (!Number.isFinite(start) && Array.isArray(cycle.orders)) {
    const orderTimes = cycle.orders
      .map((order) => parseTimestamp(order.executedAt ?? order.createdAt ?? order.updatedAt ?? null))
      .filter((value): value is number => Number.isFinite(value));
    if (orderTimes.length > 0) {
      start = Math.min(...orderTimes);
    }
  }

  if (!Number.isFinite(start)) {
    start = Number(end);
  }

  if (start > Number(end)) {
    start = Number(end);
  }

  return { start, end: Number(end) };
};

const collectCycleIntervals = (cycles: BacktestCycle[]): CycleInterval[] => {
  return cycles
    .map((cycle) => {
      const interval = resolveCycleInterval(cycle);
      if (!interval) {
        return null;
      }
      return { cycle, interval };
    })
    .filter((entry): entry is CycleInterval => Boolean(entry));
};

const computeIntervals = (cycleIntervals: CycleInterval[]): TimeInterval[] => {
  return cycleIntervals
    .map((entry) => entry.interval)
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
};

const computeDrawdownTimeline = (cycles: BacktestCycle[]): { maxDrawdown: number; events: EquityEvent[] } => {
  const events: Array<{ time: number; delta: number }> = [];

  cycles.filter(isFinishedCycle).forEach((cycle) => {
    const time = parseTimestamp(cycle.date);
    const net = toNumber(cycle.netQuote ?? cycle.profitQuote ?? 0);
    if (Number.isFinite(time) && Number.isFinite(net)) {
      events.push({ time: Number(time), delta: net });
    }
  });

  if (events.length === 0) {
    return { maxDrawdown: 0, events: [] };
  }

  events.sort((a, b) => a.time - b.time);

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const enriched: EquityEvent[] = [];

  events.forEach((event) => {
    cumulative += event.delta;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
    enriched.push({ time: event.time, delta: event.delta, cumulative, drawdown });
  });

  return { maxDrawdown, events: enriched };
};

const buildRiskIntervals = (cycleIntervals: CycleInterval[]): { riskIntervals: RiskInterval[]; maxRisk: number } => {
  const riskIntervals: RiskInterval[] = [];
  let maxRisk = 0;

  cycleIntervals.forEach(({ cycle, interval }) => {
    const value = Math.abs(toNumber(cycle.maeAbsolute ?? 0));
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    riskIntervals.push({ ...interval, value });
    if (value > maxRisk) {
      maxRisk = value;
    }
  });

  riskIntervals.sort((a, b) => (a.start - b.start) || (a.end - b.end));
  return { riskIntervals, maxRisk };
};

const computeCoverage = (intervals: TimeInterval[]): {
  totalActiveMs: number;
  spanMs: number;
  minStart: number;
  maxEnd: number;
} => {
  if (intervals.length === 0) {
    return { totalActiveMs: 0, spanMs: 0, minStart: Number.NaN, maxEnd: Number.NaN };
  }

  const sanitized = intervals
    .map((interval) => ({ start: Number(interval.start), end: Number(interval.end) }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));

  if (sanitized.length === 0) {
    return { totalActiveMs: 0, spanMs: 0, minStart: Number.NaN, maxEnd: Number.NaN };
  }

  let totalActiveMs = 0;
  let currentStart = sanitized[0].start;
  let currentEnd = sanitized[0].end;
  let minStart = currentStart;
  let maxEnd = currentEnd;

  for (let index = 1; index < sanitized.length; index += 1) {
    const { start, end } = sanitized[index];
    if (start > currentEnd) {
      totalActiveMs += Math.max(0, currentEnd - currentStart);
      currentStart = start;
      currentEnd = end;
    } else {
      currentEnd = Math.max(currentEnd, end);
    }
    if (start < minStart) {
      minStart = start;
    }
    if (end > maxEnd) {
      maxEnd = end;
    }
  }

  totalActiveMs += Math.max(0, currentEnd - currentStart);
  const spanMs = Math.max(0, maxEnd - minStart);

  return { totalActiveMs, spanMs, minStart, maxEnd };
};

const markActiveRange = (set: Set<number>, startMs: number | null, endMs: number | null) => {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return;
  }
  const start = Number(startMs);
  const end = Number(endMs);
  if (end < start) {
    return;
  }
  const startDay = Math.floor(start / MS_IN_DAY);
  const adjustedEnd = end > start ? end - 1 : end;
  const endDay = Math.floor(adjustedEnd / MS_IN_DAY);
  for (let day = startDay; day <= endDay; day += 1) {
    set.add(day);
  }
};

export const computeBacktestMetrics = (
  stats: BacktestStatisticsDetail,
  cycles: BacktestCycle[],
): BacktestAggregationMetrics => {
  const pnl = toNumber(stats.netQuote ?? stats.profitQuote ?? 0) || 0;
  const profitsCount = Math.max(0, Math.round(toNumber(stats.profits ?? 0))) || 0;
  const lossesCount = Math.max(0, Math.round(toNumber(stats.losses ?? 0))) || 0;
  const totalDeals = Math.max(0, Math.round(toNumber(stats.totalDeals ?? 0))) || 0;
  const avgDurationSec = Math.max(0, toNumber(stats.avgDuration ?? 0)) || 0;
  const totalTradeDurationSec = avgDurationSec * totalDeals;
  const avgTradeDurationDays = totalDeals > 0 ? totalTradeDurationSec / totalDeals / 86400 : 0;
  const avgNetPerDay = toNumber(stats.netQuotePerDay ?? 0) || 0;

  const cycleIntervals = collectCycleIntervals(cycles);
  const finishedCycleIntervals = cycleIntervals.filter(({ cycle }) => isFinishedCycle(cycle));
  const trades: AggregationTrade[] = [];
  let maxMPP = 0;

  cycleIntervals.forEach(({ cycle }) => {
    const mfe = Math.max(0, toNumber(cycle.mfeAbsolute ?? 0));
    if (mfe > maxMPP) {
      maxMPP = mfe;
    }
  });

  finishedCycleIntervals.forEach(({ cycle, interval }) => {
    const net = toNumber(cycle.netQuote ?? cycle.profitQuote ?? 0);
    const mfe = Math.max(0, toNumber(cycle.mfeAbsolute ?? 0));
    const mae = Math.max(0, toNumber(cycle.maeAbsolute ?? 0));
    const sanitizedNet = Number.isFinite(net) ? net : 0;
    trades.push({
      id: cycle.id,
      start: interval.start,
      end: interval.end,
      net: sanitizedNet,
      mfe,
      mae,
    });
  });

  const drawdownTimeline = computeDrawdownTimeline(cycles);
  const concurrencyIntervals = computeIntervals(cycleIntervals);
  const riskInfo = buildRiskIntervals(cycleIntervals);
  const coverage = computeCoverage(concurrencyIntervals);
  const statsSpan = resolveStatsSpan(stats);

  let spanStart = Number.isFinite(coverage.minStart) ? coverage.minStart : Number.NaN;
  let spanEnd = Number.isFinite(coverage.maxEnd) ? coverage.maxEnd : Number.NaN;

  if (statsSpan) {
    if (!Number.isFinite(spanStart) || statsSpan.start < spanStart) {
      spanStart = statsSpan.start;
    }
    if (!Number.isFinite(spanEnd) || statsSpan.end > spanEnd) {
      spanEnd = statsSpan.end;
    }
  }

  const spanMs = Number.isFinite(spanStart) && Number.isFinite(spanEnd) && spanEnd > spanStart
    ? spanEnd - spanStart
    : Math.max(coverage.spanMs, statsSpan ? Math.max(0, statsSpan.end - statsSpan.start) : 0);

  const downtimeDays = spanMs > 0 ? Math.max(spanMs - coverage.totalActiveMs, 0) / MS_IN_DAY : 0;

  const activeDaySet = new Set<number>();
  concurrencyIntervals.forEach((interval) => {
    markActiveRange(activeDaySet, interval.start, interval.end);
  });

  cycleIntervals.forEach(({ cycle, interval }) => {
    markActiveRange(activeDaySet, interval.start, interval.end);
    if (Array.isArray(cycle.orders)) {
      cycle.orders.forEach((order) => {
        const timestamp = parseTimestamp(order.executedAt ?? order.createdAt ?? order.updatedAt ?? null);
        if (Number.isFinite(timestamp)) {
          const dayIndex = Math.floor(Number(timestamp) / MS_IN_DAY);
          activeDaySet.add(dayIndex);
        }
      });
    }
  });

  const activeDayIndices = Array.from(activeDaySet.values()).sort((a, b) => a - b);

  const name = stats.name ?? '—';
  const sanitizedSymbol = stats.symbol
    || `${stats.base ?? ''}/${stats.quote ?? ''}`.replace(/^[/]+|[/]+$/g, '')
    || '—';

  return {
    id: stats.id,
    name,
    symbol: sanitizedSymbol,
    pnl,
    profitsCount,
    lossesCount,
    totalDeals,
    avgTradeDurationDays,
    totalTradeDurationSec,
    avgNetPerDay,
    maxDrawdown: drawdownTimeline.maxDrawdown,
    maxMPU: riskInfo.maxRisk,
    maxMPP,
    downtimeDays,
    spanStart: Number.isFinite(spanStart) ? spanStart : null,
    spanEnd: Number.isFinite(spanEnd) ? spanEnd : null,
    activeDurationMs: coverage.totalActiveMs,
    equityEvents: drawdownTimeline.events,
    concurrencyIntervals,
    riskIntervals: riskInfo.riskIntervals,
    activeDayIndices,
    trades,
  };
};

const computeAggregateDrawdown = (metricsList: BacktestAggregationMetrics[]): number => {
  const events: Array<{ time: number; delta: number }> = [];
  metricsList.forEach((metrics) => {
    metrics.equityEvents.forEach((event) => {
      if (Number.isFinite(event.time) && Number.isFinite(event.delta)) {
        events.push({ time: event.time, delta: event.delta });
      }
    });
  });

  if (events.length === 0) {
    return 0;
  }

  events.sort((a, b) => a.time - b.time);

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (let index = 0; index < events.length;) {
    const currentTime = events[index].time;
    let deltaSum = 0;
    while (index < events.length && events[index].time === currentTime) {
      deltaSum += events[index].delta;
      index += 1;
    }
    cumulative += deltaSum;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};

const computePortfolioEquitySeries = (metricsList: BacktestAggregationMetrics[]): PortfolioEquitySeries => {
  const trades = metricsList
    .flatMap((metrics) => metrics.trades)
    .map((trade) => ({
      start: Number(trade.start),
      end: Number(trade.end),
      net: Number(trade.net) || 0,
    }))
    .filter((trade) => Number.isFinite(trade.end));

  const spanCandidates: number[] = [];
  metricsList.forEach((metrics) => {
    if (Number.isFinite(metrics.spanStart)) {
      spanCandidates.push(Number(metrics.spanStart));
    }
  });

  trades.forEach((trade) => {
    if (Number.isFinite(trade.start)) {
      spanCandidates.push(Number(trade.start));
    }
    if (Number.isFinite(trade.end)) {
      spanCandidates.push(Number(trade.end));
    }
  });

  const points: PortfolioEquityPoint[] = [];
  const initialTime = spanCandidates.length > 0 ? Math.min(...spanCandidates) : Number.NaN;

  if (!Number.isFinite(initialTime) && trades.length === 0) {
    return { points: [], minValue: 0, maxValue: 0 };
  }

  if (Number.isFinite(initialTime)) {
    points.push({
      time: Number(initialTime),
      value: 0,
    });
  }

  if (trades.length === 0) {
    return { points, minValue: 0, maxValue: 0 };
  }

  trades.sort((a, b) => {
    if (a.end === b.end) {
      if (a.start === b.start) {
        return 0;
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

  let cumulative = 0;

  trades.forEach((trade) => {
    cumulative += trade.net;
    points.push({
      time: Number(trade.end),
      value: cumulative,
    });
  });

  const values = points.map((point) => point.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 0;

  return { points, minValue, maxValue };
};

const computeNoTradeInfo = (metricsList: BacktestAggregationMetrics[]): { totalDays: number; noTradeDays: number } => {
  let minDay = Number.POSITIVE_INFINITY;
  let maxDay = Number.NEGATIVE_INFINITY;
  const activeDays = new Set<number>();

  metricsList.forEach((metrics) => {
    metrics.activeDayIndices.forEach((dayIndex) => {
      if (Number.isInteger(dayIndex)) {
        activeDays.add(dayIndex);
        if (dayIndex < minDay) {
          minDay = dayIndex;
        }
        if (dayIndex > maxDay) {
          maxDay = dayIndex;
        }
      }
    });

    if (Number.isFinite(metrics.spanStart)) {
      const startDay = Math.floor(Number(metrics.spanStart) / MS_IN_DAY);
      if (startDay < minDay) {
        minDay = startDay;
      }
    }
    if (Number.isFinite(metrics.spanEnd)) {
      const spanEndValue = Number(metrics.spanEnd);
      const spanStartValue = Number.isFinite(metrics.spanStart) ? Number(metrics.spanStart) : spanEndValue;
      const endAnchor = spanEndValue > spanStartValue ? spanEndValue - 1 : spanEndValue;
      const endDay = Math.floor(endAnchor / MS_IN_DAY);
      if (endDay > maxDay) {
        maxDay = endDay;
      }
    }
  });

  if (!Number.isFinite(minDay) || !Number.isFinite(maxDay) || maxDay < minDay) {
    return { totalDays: 0, noTradeDays: 0 };
  }

  const totalDays = maxDay - minDay + 1;
  let activeDayCount = 0;
  for (let day = minDay; day <= maxDay; day += 1) {
    if (activeDays.has(day)) {
      activeDayCount += 1;
    }
  }

  const noTradeDays = Math.max(totalDays - activeDayCount, 0);
  return { totalDays, noTradeDays };
};

interface ConcurrencyResult {
  max: number;
  average: number;
  totalSpanMs: number;
  zeroSpanMs: number;
}

const computeConcurrency = (metricsList: BacktestAggregationMetrics[]): ConcurrencyResult => {
  const events: Array<{ time: number; type: 'start' | 'end' }> = [];
  let minSpanStart = Number.POSITIVE_INFINITY;
  let maxSpanEnd = Number.NEGATIVE_INFINITY;

  metricsList.forEach((metrics) => {
    if (Number.isFinite(metrics.spanStart) && Number(metrics.spanStart) < minSpanStart) {
      minSpanStart = Number(metrics.spanStart);
    }
    if (Number.isFinite(metrics.spanEnd) && Number(metrics.spanEnd) > maxSpanEnd) {
      maxSpanEnd = Number(metrics.spanEnd);
    }

    metrics.concurrencyIntervals.forEach((interval) => {
      if (Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end >= interval.start) {
        events.push({ time: interval.start, type: 'start' });
        events.push({ time: interval.end, type: 'end' });
        if (interval.start < minSpanStart) {
          minSpanStart = interval.start;
        }
        if (interval.end > maxSpanEnd) {
          maxSpanEnd = interval.end;
        }
      }
    });
  });

  if (
    !Number.isFinite(minSpanStart)
    || !Number.isFinite(maxSpanEnd)
    || maxSpanEnd <= minSpanStart
  ) {
    if (events.length === 0) {
      return { max: 0, average: 0, totalSpanMs: 0, zeroSpanMs: 0 };
    }
    minSpanStart = events[0].time;
    maxSpanEnd = events[events.length - 1].time;
  }

  if (events.length === 0) {
    const totalSpanMs = Math.max(maxSpanEnd - minSpanStart, 0);
    return { max: 0, average: 0, totalSpanMs, zeroSpanMs: Math.max(totalSpanMs, 0) };
  }

  events.sort((a, b) => {
    if (a.time === b.time) {
      if (a.type === b.type) {
        return 0;
      }
      return a.type === 'start' ? -1 : 1;
    }
    return a.time - b.time;
  });

  let current = 0;
  let max = 0;
  let weightedSum = 0;
  let totalDuration = 0;
  let activeDuration = 0;
  let previousTime = events[0].time;

  if (!Number.isFinite(minSpanStart) || minSpanStart > previousTime) {
    minSpanStart = previousTime;
  }

  events.forEach((event) => {
    if (event.time > previousTime) {
      const duration = event.time - previousTime;
      weightedSum += current * duration;
      totalDuration += duration;
      if (current > 0) {
        activeDuration += duration;
      }
      previousTime = event.time;
    }

    if (event.type === 'start') {
      current += 1;
      if (current > max) {
        max = current;
      }
    } else {
      current = Math.max(0, current - 1);
    }
  });

  const lastEventTime = previousTime;
  if (!Number.isFinite(maxSpanEnd) || maxSpanEnd < lastEventTime) {
    maxSpanEnd = lastEventTime;
  }

  if (maxSpanEnd > lastEventTime) {
    const tailDuration = maxSpanEnd - lastEventTime;
    if (current > 0) {
      activeDuration += tailDuration;
    }
    totalDuration += tailDuration;
  }

  const totalSpanMs = Number.isFinite(minSpanStart) && Number.isFinite(maxSpanEnd) && maxSpanEnd > minSpanStart
    ? maxSpanEnd - minSpanStart
    : totalDuration;
  const zeroSpanMs = Math.max(Math.min(totalSpanMs - activeDuration, totalSpanMs), 0);

  return {
    max,
    average: totalDuration > 0 ? weightedSum / totalDuration : 0,
    totalSpanMs,
    zeroSpanMs,
  };
};

const computePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const clamped = Math.min(Math.max(percentile, 0), 1);
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 0) {
    return 0;
  }

  if (clamped <= 0) {
    return sorted[0];
  }
  if (clamped >= 1) {
    return sorted[sorted.length - 1];
  }

  const index = (sorted.length - 1) * clamped;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
};

const computeDailyConcurrency = (metricsList: BacktestAggregationMetrics[]): DailyConcurrencyResult => {
  const events: Array<{ time: number; type: 'start' | 'end' }> = [];

  metricsList.forEach((metrics) => {
    metrics.concurrencyIntervals.forEach((interval) => {
      if (Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start) {
        events.push({ time: interval.start, type: 'start' });
        events.push({ time: interval.end, type: 'end' });
      }
    });
  });

  if (events.length === 0) {
    return {
      records: [],
      stats: {
        meanMax: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        limits: { p75: 0, p90: 0, p95: 0 },
      },
    };
  }

  events.sort((a, b) => {
    if (a.time === b.time) {
      if (a.type === b.type) {
        return 0;
      }
      return a.type === 'start' ? -1 : 1;
    }
    return a.time - b.time;
  });

  const dayMap = new Map<number, {
    dayIndex: number;
    dayStartMs: number;
    activeDurationMs: number;
    weightedSum: number;
    maxCount: number;
  }>();

  let current = 0;
  let previousTime = events[0].time;

  const accumulate = (start: number, end: number, count: number) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || count <= 0) {
      return;
    }
    let segmentStart = start;
    while (segmentStart < end) {
      const dayIndex = Math.floor(segmentStart / MS_IN_DAY);
      const dayEnd = Math.min(end, (dayIndex + 1) * MS_IN_DAY);
      const duration = dayEnd - segmentStart;
      if (duration <= 0) {
        break;
      }
      const existing = dayMap.get(dayIndex);
      if (existing) {
        existing.activeDurationMs += duration;
        existing.weightedSum += duration * count;
        if (count > existing.maxCount) {
          existing.maxCount = count;
        }
      } else {
        dayMap.set(dayIndex, {
          dayIndex,
          dayStartMs: dayIndex * MS_IN_DAY,
          activeDurationMs: duration,
          weightedSum: duration * count,
          maxCount: count,
        });
      }
      segmentStart = dayEnd;
    }
  };

  events.forEach((event) => {
    if (event.time > previousTime && current > 0) {
      accumulate(previousTime, event.time, current);
    }
    previousTime = event.time;
    if (event.type === 'start') {
      current += 1;
    } else {
      current = Math.max(0, current - 1);
    }
  });

  const records = Array.from(dayMap.values())
    .filter((entry) => entry.activeDurationMs > 0 && entry.maxCount > 0)
    .sort((a, b) => a.dayIndex - b.dayIndex)
    .map((entry) => ({
      dayIndex: entry.dayIndex,
      dayStartMs: entry.dayStartMs,
      activeDurationMs: entry.activeDurationMs,
      maxCount: entry.maxCount,
      avgActiveCount: entry.activeDurationMs > 0 ? entry.weightedSum / entry.activeDurationMs : 0,
    }));

  const dailyMaxValues = records
    .map((entry) => entry.maxCount)
    .filter((value) => Number.isFinite(value));

  const meanMax = dailyMaxValues.length > 0
    ? dailyMaxValues.reduce((acc, value) => acc + value, 0) / dailyMaxValues.length
    : 0;
  const p75 = computePercentile(dailyMaxValues, 0.75);
  const p90 = computePercentile(dailyMaxValues, 0.9);
  const p95 = computePercentile(dailyMaxValues, 0.95);

  return {
    records,
    stats: {
      meanMax,
      p75,
      p90,
      p95,
      limits: {
        p75: Math.ceil(p75),
        p90: Math.ceil(p90),
        p95: Math.ceil(p95),
      },
    },
  };
};

export const summarizeAggregations = (metricsList: BacktestAggregationMetrics[]): AggregationSummary => {
  const totalSelected = metricsList.length;
  const totalPnl = metricsList.reduce((acc, metrics) => acc + (Number(metrics.pnl) || 0), 0);
  const totalProfits = metricsList.reduce((acc, metrics) => acc + (Number(metrics.profitsCount) || 0), 0);
  const totalLosses = metricsList.reduce((acc, metrics) => acc + (Number(metrics.lossesCount) || 0), 0);
  const totalDeals = metricsList.reduce((acc, metrics) => acc + (Number(metrics.totalDeals) || 0), 0);
  const totalTradeDurationSec = metricsList.reduce((acc, metrics) => acc + (Number(metrics.totalTradeDurationSec) || 0), 0);
  const totalAvgNetPerDay = metricsList.reduce((acc, metrics) => acc + (Number(metrics.avgNetPerDay) || 0), 0);

  const avgPnlPerDeal = totalDeals > 0 ? totalPnl / totalDeals : 0;
  const avgPnlPerBacktest = totalSelected > 0 ? totalPnl / totalSelected : 0;
  const avgNetPerDay = totalSelected > 0 ? totalAvgNetPerDay / totalSelected : 0;
  const avgTradeDurationDays = totalDeals > 0 ? totalTradeDurationSec / totalDeals / 86400 : 0;
  const avgMaxDrawdown = totalSelected > 0
    ? metricsList.reduce((acc, metrics) => acc + (Number(metrics.maxDrawdown) || 0), 0) / totalSelected
    : 0;

  const aggregateDrawdown = computeAggregateDrawdown(metricsList);
  const concurrency = computeConcurrency(metricsList);
  const noTradeInfo = computeNoTradeInfo(metricsList);
  const dailyConcurrency = computeDailyConcurrency(metricsList);
  const portfolioEquity = computePortfolioEquitySeries(metricsList);
  return {
    totalSelected,
    totalPnl,
    totalProfits,
    totalLosses,
    totalDeals,
    avgPnlPerDeal,
    avgPnlPerBacktest,
    avgNetPerDay,
    avgTradeDurationDays,
    avgMaxDrawdown,
    aggregateDrawdown,
    maxConcurrent: concurrency.max,
    avgConcurrent: concurrency.average,
    noTradeDays: noTradeInfo.noTradeDays,
    dailyConcurrency,
    portfolioEquity,
  };
};
