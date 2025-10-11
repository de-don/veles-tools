import { getApiBaseUrl } from '../api/baseUrl';

const normalizePath = (path: string): string => {
  const trimmed = path.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '';
};

export const buildCabinetUrl = (path: string): string => {
  const origin = getApiBaseUrl().replace(/\/$/, '');
  const sanitizedPath = normalizePath(path);
  return sanitizedPath.length > 0 ? `${origin}/cabinet/${sanitizedPath}` : `${origin}/cabinet`;
};

export const buildBotDetailsUrl = (botId: number): string => {
  if (!Number.isFinite(botId)) {
    throw new Error('Некорректный идентификатор бота.');
  }
  const normalizedId = Math.trunc(botId);
  return buildCabinetUrl(`bot/${normalizedId}`);
};

export const buildDealStatisticsUrl = (dealId: number): string => {
  if (!Number.isFinite(dealId)) {
    throw new Error('Некорректный идентификатор сделки.');
  }
  const normalizedId = Math.trunc(dealId);
  return buildCabinetUrl(`statistics/${normalizedId}`);
};
