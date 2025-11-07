import type { BacktestConfigDto, BacktestStatisticsDto } from '../api/backtests.dtos';
import type { BacktestDetail, BacktestStatistics } from '../types/backtests';

export const mapStatisticsFromDto = (statistics: BacktestStatisticsDto): BacktestStatistics => ({
  ...statistics,
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
