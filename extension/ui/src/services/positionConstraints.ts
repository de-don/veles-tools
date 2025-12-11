import { fetchPositionConstraints, updatePositionConstraint } from '../api/constraints';
import type { PositionConstraintDto, UpdatePositionConstraintRequestDto } from '../api/constraints.dtos';
import type { PositionConstraint } from '../types/positionConstraints';

const sanitizeOptionalLimit = (value: number | null): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
};

const mapConstraintFromDto = (dto: PositionConstraintDto): PositionConstraint => {
  return {
    apiKeyId: dto.apiKeyId,
    apiKeyName: dto.apiKeyName,
    exchange: dto.exchange,
    positionEnabled: Boolean(dto.position),
    limit: typeof dto.limit === 'number' && Number.isFinite(dto.limit) ? Math.max(0, Math.trunc(dto.limit)) : 0,
    long: sanitizeOptionalLimit(dto.long),
    short: sanitizeOptionalLimit(dto.short),
  };
};

const sanitizeLimit = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.trunc(value);
};

export const getPositionConstraints = async (): Promise<PositionConstraint[]> => {
  const dtos = await fetchPositionConstraints();
  return dtos.map(mapConstraintFromDto);
};

export interface UpdateConstraintLimitPayload {
  apiKeyId: number;
  limit: number;
  positionEnabled: boolean;
  long?: number | null;
  short?: number | null;
}

export const setPositionConstraintLimit = async (payload: UpdateConstraintLimitPayload): Promise<void> => {
  const requestPayload: UpdatePositionConstraintRequestDto = {
    apiKeyId: payload.apiKeyId,
    limit: sanitizeLimit(payload.limit),
    position: payload.positionEnabled,
    long: typeof payload.long === 'number' && Number.isFinite(payload.long) ? Math.trunc(payload.long) : null,
    short: typeof payload.short === 'number' && Number.isFinite(payload.short) ? Math.trunc(payload.short) : null,
  };

  await updatePositionConstraint(requestPayload);
};

export const positionConstraintsService = {
  getPositionConstraints,
  setPositionConstraintLimit,
};

export type PositionConstraintsService = typeof positionConstraintsService;
