import type {
  BotDepositConfigDto,
  BotDto,
  BotIdentifierDto,
  BotOrderDto,
  BotProfitConfigDto,
  BotSettingsDto,
  BotStopLossConfigDto,
  BotsListResponseDto,
  ConditionGroupsDto,
  ConditionOperationNode as ConditionOperationNodeDto,
  ConditionSignalNode as ConditionSignalNodeDto,
  ConditionValueNode as ConditionValueNodeDto,
  LegacyConditionDto as LegacyConditionDtoDto,
} from '../api/bots.dtos';

export type BotIdentifier = BotIdentifierDto;

export type BotAlgorithm = 'LONG' | 'SHORT' | string;

export const BOT_STATUS_VALUES = [
  'RUNNING',
  'AWAITING_SIGNAL',
  'TERMINATED',
  'AWAITING_TERMINATION',
  'FAILED',
] as const;

export interface BotsListFilters {
  name?: string;
  apiKey?: number;
  statuses?: BotStatus[];
  algorithms?: BotAlgorithm[];
}

export interface BotsListParams {
  page: number;
  size: number;
  sort?: string;
  filters?: BotsListFilters;
}

export interface BotsListResponse extends Omit<BotsListResponseDto, 'content'> {
  content: TradingBot[];
}

export interface TradingBot
  extends Omit<BotDto, 'algorithm' | 'status' | 'profit' | 'deposit' | 'settings' | 'stopLoss'> {
  algorithm: BotAlgorithm;
  status: BotStatus;
  profit: BotProfitConfig | null;
  deposit: BotDepositConfig;
  settings: BotSettings;
  stopLoss: BotStopLossConfig | null;
}

export interface BotSummary {
  id: BotIdentifier;
  name: string;
  exchange: string;
  algorithm: BotAlgorithm;
  status: BotStatus;
  substatus: string | null;
  origin?: 'account' | 'imported';
}

export type BotProfitConfig = BotProfitConfigDto;

export type BotDepositConfig = BotDepositConfigDto;

export type BotOrder = BotOrderDto;

export type BotSettings = BotSettingsDto;

export type ConditionGroups = ConditionGroupsDto;

export type ConditionValueNode = ConditionValueNodeDto;

export type ConditionOperationNode = ConditionOperationNodeDto;

export type ConditionSignalNode = ConditionSignalNodeDto;

export type LegacyConditionDto = LegacyConditionDtoDto;

export type BotStopLossConfig = BotStopLossConfigDto;

export type BotStatus = (typeof BOT_STATUS_VALUES)[number];
