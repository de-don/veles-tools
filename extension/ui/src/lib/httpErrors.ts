import type { ProxyResponsePayload } from './extensionMessaging';

interface ApiErrorObject {
  status?: number;
  error?: string;
  message?: string;
  detail?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const pickTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatStatusLabel = (status?: number, statusText?: string): string | null => {
  if (typeof status !== 'number') {
    return null;
  }
  const trimmedStatusText = pickTrimmed(statusText);
  if (trimmedStatusText) {
    return `HTTP ${status} ${trimmedStatusText}`;
  }
  return `HTTP ${status}`;
};

const extractMessageFromBody = (body: unknown): string | null => {
  if (typeof body === 'string') {
    return pickTrimmed(body);
  }

  if (!isRecord(body)) {
    return null;
  }

  const candidate = body as ApiErrorObject;
  const primary = pickTrimmed(candidate.message) ?? pickTrimmed(candidate.detail);
  const secondary = pickTrimmed(candidate.error);

  if (primary && secondary && primary !== secondary) {
    return `${primary} (${secondary})`;
  }

  return primary ?? secondary ?? null;
};

export const resolveProxyErrorMessage = <TBody>(response: ProxyResponsePayload<TBody>): string => {
  const directError = pickTrimmed(response.error);
  if (directError) {
    return directError;
  }

  const statusLabel = formatStatusLabel(response.status, response.statusText);
  const bodyMessage = extractMessageFromBody(response.body);

  if (bodyMessage) {
    return statusLabel ? `${statusLabel}: ${bodyMessage}` : bodyMessage;
  }

  if (statusLabel) {
    return statusLabel;
  }

  const fallback = pickTrimmed(response.statusText);
  return fallback ?? 'Неизвестная ошибка';
};
