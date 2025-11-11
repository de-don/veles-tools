import type {
  BacktestConfigDto,
  BacktestCycleDto,
  BacktestOrderDto,
  BacktestStatisticsDto,
} from '../api/backtests.dtos';

export interface BacktestsListParams {
  page: number;
  size: number;
  sort?: string;
}

export interface BacktestStatistics extends BacktestStatisticsDto {}

export interface BacktestDetail {
  statistics: BacktestStatistics;
  config: BacktestConfigDto;
}

export interface BacktestStatisticsListResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestStatistics[];
}

export type BacktestCycle = BacktestCycleDto;
export type BacktestOrder = BacktestOrderDto;
