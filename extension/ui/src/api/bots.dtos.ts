export type BotIdentifierDto = number | string;

/**
 * The API currently accepts strategy conditions in TWO formats depending on the bot
 * (older bots/algorithms still use the flat list, newer ones use the nested tree).
 * Both must be modelled and passed through as-is — never force-convert one into the other.
 */
export interface LegacyConditionDto {
  type: string;
  indicator: string | null;
  interval: string | null;
  basic: boolean | null;
  value: number | null;
  operation: string | null;
  closed: boolean | null;
  reverse: boolean | null;
}

/** New tree format: conditionGroups is an OR of groups, each group an AND of nodes. */
export interface ConditionIndicatorNode {
  type: 'INDICATOR';
  indicator: string;
  timeFrame: number;
  method: string;
  shift: number;
  [param: string]: string | number | undefined;
}

export interface ConditionConstantNode {
  type: 'CONSTANT';
  value: number;
}

export type ConditionValueNode = ConditionIndicatorNode | ConditionConstantNode;

export interface ConditionOperationNode {
  type: 'OPERATION';
  left: ConditionValueNode;
  operator: string;
  right: ConditionValueNode;
}

/** e.g. LIQUIDATION_HEATMAP — a standalone signal condition, not a left/right comparison. */
export interface ConditionSignalNode {
  type: 'SIGNAL';
  signal: string;
  timeFrame: number;
  method: string;
  shift: number;
  [param: string]: string | number | undefined;
}

export type ConditionGroupItem = ConditionOperationNode | ConditionSignalNode;

export type ConditionGroupsDto = ConditionGroupItem[][];

export interface BotOrderDto {
  indent: number | null;
  volume: number | null;
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
  expanded?: boolean | null;
}

export interface BotProfitOrderStep {
  indent: number;
  volume: number;
}

export interface BotProfitConfigDto {
  type: string;
  currency: string;
  checkPnl?: number | null;
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
  /** type === 'MULTIPLE' shape: staged take-profit orders instead of conditions. */
  orders?: BotProfitOrderStep[] | null;
  breakeven?: string | null;
  breakevenOffset?: number | null;
}

export interface BotDepositConfigDto {
  amount: number;
  leverage: number;
  marginType: 'ISOLATED' | 'CROSS';
  currency?: string | null;
  reinvest?: number | null;
}

export interface BotStopLossConfigDto {
  indent: number | null;
  termination: boolean | null;
  conditionalIndent: number | null;
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
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
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
  status: string;
  apiKey: number | null;
  substatus: string | null;
  symbols: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
  stopLoss?: BotStopLossConfigDto | null;
  termination: number | null; // remaining-deals limit ("остановить после N сделок")
  dealsLeft?: number | null;
  // Public-strategy marketplace metadata (present when bot is published as a public strategy).
  forBeginners?: boolean | null;
  new?: boolean | null;
  hot?: boolean | null;
  categories?: string[] | null;
}

export interface BotsListResponseDto {
  totalElements: number;
  totalPages: number;
  pageNumber: number;
  content: BotDto[];
}

// The order of fields is the same as in the API payload.
// conditionGroups/conditions: send back whichever format the source bot actually used — never both, never force-convert.
export interface BotConfigCreateDto {
  algorithm: string;
  apiKey: number;
  conditionGroups?: ConditionGroupsDto | null;
  conditions?: LegacyConditionDto[] | null;
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
  termination: number | null; // remaining-deals limit ("остановить после N сделок")
  forBeginners?: boolean | null;
  new?: boolean | null;
  hot?: boolean | null;
  categories?: string[] | null;
}
