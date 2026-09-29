import { proxyHttpRequest } from '../lib/extensionMessaging';
import { resolveProxyErrorMessage } from '../lib/httpErrors';
import { buildApiUrl } from './baseUrl';
import type { PairsAvailabilityDictionaryDto } from './pairsAvailability.dtos';

const PAIRS_AVAILABILITY_ENDPOINT = buildApiUrl('/api/pairs/availability/dictionary');

export const fetchPairsAvailability = async (exchange: string): Promise<PairsAvailabilityDictionaryDto> => {
  const params = new URLSearchParams({ exchange });
  const response = await proxyHttpRequest<PairsAvailabilityDictionaryDto>({
    url: `${PAIRS_AVAILABILITY_ENDPOINT}?${params.toString()}`,
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
    throw new Error('Пустой ответ сервера при загрузке дат листинга.');
  }

  return response.body;
};
