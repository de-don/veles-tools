import type { BacktestInfoDeal } from '../types/backtestInfos';

export type DealInclusionStatus = 'excluded' | 'fullIncluded' | 'partialEnd' | 'open';

export const filterDealByPeriod = (
  deal: BacktestInfoDeal,
  periodStart: number,
  periodEnd: number,
): DealInclusionStatus => {
  if (deal.start > periodEnd) {
    return 'excluded';
  }

  if (deal.end < periodStart) {
    return 'excluded';
  }

  if (deal.start >= periodStart && deal.end <= periodEnd) {
    return deal.status === 'STARTED' ? 'open' : 'fullIncluded';
  }

  if (deal.status === 'STARTED') {
    return 'open';
  }

  return 'partialEnd';
};

export const shouldShowOnCharts = (status: DealInclusionStatus): boolean => {
  return status !== 'excluded';
};

export const shouldCountInPnl = (status: DealInclusionStatus): boolean => {
  return status !== 'excluded';
};

export const isOpenDeal = (status: DealInclusionStatus): boolean => {
  return status === 'open';
};
