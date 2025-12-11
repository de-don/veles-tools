import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';
import type { PositionConstraintDto, UpdatePositionConstraintRequestDto } from './constraints.dtos';

const CONSTRAINTS_ENDPOINT = buildApiUrl('/api/constraints');

export const fetchPositionConstraints = async (): Promise<PositionConstraintDto[]> => {
  const response = await proxyHttpRequest<PositionConstraintDto[]>({
    url: CONSTRAINTS_ENDPOINT,
    init: {
      method: 'GET',
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
      },
    },
  });

  if (!response.ok) {
    const message = resolveProxyErrorMessage(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('Пустой ответ сервера при загрузке ограничений.');
  }

  return response.body;
};

export const updatePositionConstraint = async (payload: UpdatePositionConstraintRequestDto): Promise<void> => {
  const response = await proxyHttpRequest<unknown>({
    url: CONSTRAINTS_ENDPOINT,
    init: {
      method: 'PUT',
      credentials: 'include',
      headers: {
        accept: 'application/json, text/plain, */*',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  });

  if (!response.ok) {
    const message = resolveProxyErrorMessage(response);
    throw new Error(message);
  }
};
