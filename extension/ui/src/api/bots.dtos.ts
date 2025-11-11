export type BotIdentifierDto = number | string;

export interface StrategyConditionDto {
  type: string;
  indicator: string | null;
  interval: string | null;
  basic: boolean | null;
  value: number | null;
  operation: string | null;
  closed: boolean | null;
  reverse: boolean | null;
}

export interface BotOrderDto {
  indent: number | null;
  volume: number | null;
  conditions?: StrategyConditionDto[] | null;
}

export interface BotProfitConfigDto {
  type: string;
  currency: string;
  checkPnl: number | null;
  conditions: StrategyConditionDto[] | null;
}

export interface BotDepositConfigDto {
  amount: number;
  leverage: number;
  marginType: 'ISOLATED' | 'CROSS';
  currency: string | null;
}

export interface BotStopLossConfigDto {
  indent: number | null;
  termination: boolean | null;
  conditionalIndent: number | null;
  conditions: StrategyConditionDto[] | null;
  conditionalIndentType: string | null;
}

export type BotSettingsScalar = string | number | boolean | null;

export type BotSettingsValue =
  | BotSettingsScalar
  | BotSettingsScalar[]
  | { [key: string]: BotSettingsScalar | BotSettingsScalar[] | null }
  | BotOrderDto
  | BotOrderDto[];

export interface BotSettingsDto {
  type: string;
  includePosition?: boolean | null;
  baseOrder?: BotOrderDto | null;
  orders?: BotOrderDto[] | null;
  indentType?: string | null;
  [key: string]: BotSettingsValue | undefined;
}

export interface BotDto {
  id: BotIdentifierDto;
  name: string;
  exchange: string;
  algorithm: string;
  pullUp: number | null;
  portion: number | null;
  profit: BotProfitConfigDto | null;
  deposit: BotDepositConfigDto | null;
  settings: BotSettingsDto | null;
  conditions: StrategyConditionDto[] | null;
  status: string;
  apiKey: number | null;
  substatus: string | null;
  symbols: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  stopLoss?: BotStopLossConfigDto | null;
}

export interface BotsListResponseDto {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BotDto[];
}

// The order of fields is the same as in the API payload.
export interface BotConfigCreateDto {
  algorithm: string;
  apiKey: number;
  conditions: StrategyConditionDto[];
  deposit: BotDepositConfigDto;
  exchange: string;
  id: number | null; // number is for updates
  name: string;
  portion: number | null;
  profit: BotProfitConfigDto | null;
  pullUp: number | null;
  settings: BotSettingsDto | null;
  stopLoss: BotStopLossConfigDto | null;
  symbols: string[];
  termination: unknown | null; // TODO: check type in API.
}
