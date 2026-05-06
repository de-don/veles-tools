import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';
import type { UserBalanceDto } from './users.dtos';

const USERS_ENDPOINT = buildApiUrl('/api/users');

export const fetchUserBalance = async (): Promise<UserBalanceDto> => {
  const response = await proxyHttpRequest<UserBalanceDto>({
    url: `${USERS_ENDPOINT}/balance`,
    init: {
      method: 'GET',
      credentials: 'include',
    },
  });

  if (!response.ok) {
    const errorMessage = resolveProxyErrorMessage(response);
    throw new Error(errorMessage);
  }

  const { body } = response;
  if (!body) {
    throw new Error('Пустой ответ сервера.');
  }

  return body;
};
