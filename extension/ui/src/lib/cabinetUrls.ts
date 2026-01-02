import { getApiBaseUrl } from '../api/baseUrl';

const normalizePath = (path: string): string => {
  const trimmed = path.trim().replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '';
};

export const buildVelesUrl = (path = ''): string => {
  const origin = getApiBaseUrl().replace(/\/$/, '');
  const sanitizedPath = normalizePath(path);
  return sanitizedPath.length > 0 ? `${origin}/${sanitizedPath}` : origin;
};

export const buildCabinetUrl = (path = ''): string => {
  const sanitizedPath = normalizePath(path);
  return buildVelesUrl(sanitizedPath.length > 0 ? `cabinet/${sanitizedPath}` : 'cabinet');
};

export const buildBotDetailsUrl = (botId: number | string): string => {
  const numericId = typeof botId === 'string' ? Number(botId) : botId;
  if (!Number.isFinite(numericId)) {
    throw new Error('Некорректный идентификатор бота.');
  }
  const normalizedId = Math.trunc(numericId);
  return buildCabinetUrl(`bot/${normalizedId}`);
};

export const buildDealStatisticsUrl = (dealId: number): string => {
  if (!Number.isFinite(dealId)) {
    throw new Error('Некорректный идентификатор сделки.');
  }
  const normalizedId = Math.trunc(dealId);
  return buildCabinetUrl(`statistics/${normalizedId}`);
};
