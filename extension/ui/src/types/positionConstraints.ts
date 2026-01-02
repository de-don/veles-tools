export interface PositionConstraint {
  apiKeyId: number;
  apiKeyName: string;
  exchange: string;
  positionEnabled: boolean;
  limit: number;
  long: number | null;
  short: number | null;
}

export interface DynamicBlockConfig {
  apiKeyId: number;
  minPositionsBlock: number;
  maxPositionsBlock: number;
  timeoutBetweenChangesSec: number;
  checkPeriodSec: number;
  enabled: boolean;
  lastChangeAt: number | null;
}
