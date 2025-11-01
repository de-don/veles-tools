import type {
  BacktestConfigDto,
  BacktestCycleDto,
  BacktestDepositConfigDto,
  BacktestOrderDto,
  BacktestStatisticsDto,
} from '../api/backtests.dtos';

export interface BacktestsListParams {
  page: number;
  size: number;
  sort?: string;
}

export interface BacktestStatistics extends BacktestStatisticsDto {
  deposit?: BacktestDepositConfigDto | null;
}

export interface BacktestDetail {
  statistics: BacktestStatistics;
  config: BacktestConfigDto;
  symbols?: string[] | null;
  includePosition?: boolean | null;
}

export interface BacktestStatisticsListResponse {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BacktestStatistics[];
}

export type BacktestCycle = BacktestCycleDto;
export type BacktestOrder = BacktestOrderDto;
