import type { BacktestConfigDto, BacktestStatisticsDto, LegacyBacktestStatisticsDto } from '../api/backtests.dtos';
import type { BacktestDetail, BacktestStatistics } from '../types/backtests';

const pickNumber = (...values: (number | null | undefined)[]): number => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
};

/**
 * The 2026 API schema dropped netBase/netQuote/netBasePerDay/netQuotePerDay and made
 * profitBase/profitQuote/basePerDay/quotePerDay carry the net (after-commission) values.
 * Records cached in IndexedDB before that change still use the old shape, so they are
 * upgraded here instead of rendering as `undefined`.
 */
export const mapStatisticsFromDto = (
  statistics: BacktestStatisticsDto & LegacyBacktestStatisticsDto,
): BacktestStatistics => ({
  ...statistics,
  profitBase: pickNumber(statistics.netBase, statistics.profitBase),
  profitQuote: pickNumber(statistics.netQuote, statistics.profitQuote),
  basePerDay: pickNumber(statistics.basePerDay, statistics.netBasePerDay),
  quotePerDay: pickNumber(statistics.quotePerDay, statistics.netQuotePerDay),
});

export const mapDetailFromDto = (statistics: BacktestStatisticsDto, config: BacktestConfigDto): BacktestDetail => {
  const mappedStatistics: BacktestStatistics = {
    ...mapStatisticsFromDto(statistics),
  };

  return {
    statistics: mappedStatistics,
    config,
  };
};

export const mapStatisticsListFromDto = (items: BacktestStatisticsDto[]): BacktestStatistics[] =>
  items.map((item) => mapStatisticsFromDto(item));
