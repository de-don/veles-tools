export interface PositionConstraintDto {
  apiKeyId: number;
  apiKeyName: string;
  exchange: string;
  /** Block by asset */
  position: boolean;
  limit: number | null;
  long: number | null;
  short: number | null;
}

export interface UpdatePositionConstraintRequestDto {
  apiKeyId: number;
  position: boolean;
  limit: number;
  long: number | null;
  short: number | null;
}
