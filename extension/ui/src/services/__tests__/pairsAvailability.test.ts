import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPairsAvailability } from '../../api/pairsAvailability';
import { clampPeriodStartToListing, getPairListingDate, resetPairsAvailabilityCache } from '../pairsAvailability';

vi.mock('../../api/pairsAvailability', () => ({
  fetchPairsAvailability: vi.fn(),
}));

const fetchMock = vi.mocked(fetchPairsAvailability);

describe('getPairListingDate', () => {
  afterEach(() => {
    resetPairsAvailabilityCache();
    fetchMock.mockReset();
  });

  it('finds the listing date by symbol and caches the dictionary per exchange', async () => {
    fetchMock.mockResolvedValue({
      checksum: 'abc',
      payload: [
        { symbol: 'BTC/USDT', availableFrom: '2019-09-08T00:00:00Z' },
        { symbol: 'NEW/USDT', availableFrom: '2025-06-01T12:00:00Z' },
      ],
    });

    expect(await getPairListingDate('BINANCE_FUTURES', 'NEW/USDT')).toEqual(new Date('2025-06-01T12:00:00Z'));
    expect(await getPairListingDate('BINANCE_FUTURES', 'BTCUSDT')).toEqual(new Date('2019-09-08T00:00:00Z'));
    expect(await getPairListingDate('BINANCE_FUTURES', 'ETH/USDT')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('BINANCE_FUTURES');
  });

  it('retries after a failed request', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    await expect(getPairListingDate('BYBIT_FUTURES', 'BTC/USDT')).rejects.toThrow('boom');

    fetchMock.mockResolvedValueOnce({ checksum: 'x', payload: [{ symbol: 'BTC/USDT', availableFrom: '2020-03-25' }] });
    expect(await getPairListingDate('BYBIT_FUTURES', 'BTC/USDT')).toEqual(new Date('2020-03-25'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('clampPeriodStartToListing', () => {
  const start = '2024-01-01T00:00:00.000Z';
  const end = '2024-12-31T23:59:59.999Z';

  it('keeps the start when the listing date is unknown or earlier', () => {
    expect(clampPeriodStartToListing(start, end, null)).toEqual({ kind: 'unchanged', startISO: start });
    expect(clampPeriodStartToListing(start, end, new Date('2023-05-01T00:00:00Z'))).toEqual({
      kind: 'unchanged',
      startISO: start,
    });
  });

  it('moves the start to the listing date when the period starts earlier', () => {
    expect(clampPeriodStartToListing(start, end, new Date('2024-06-15T08:00:00Z'))).toEqual({
      kind: 'clamped',
      startISO: '2024-06-15T08:00:00.000Z',
    });
  });

  it('reports pairs listed after the period end', () => {
    expect(clampPeriodStartToListing(start, end, new Date('2025-02-01T00:00:00Z'))).toEqual({
      kind: 'notListed',
      listingISO: '2025-02-01T00:00:00.000Z',
    });
  });
});
