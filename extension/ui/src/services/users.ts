import { fetchUserBalance } from '../api/users';
import type { UserBalance } from '../types/users';

const ACCOUNT_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
let userBalanceCache: { value: UserBalance; fetchedAt: number } | null = null;
let userBalanceErrorCache: { error: Error; fetchedAt: number } | null = null;
let userBalanceRequest: Promise<UserBalance> | null = null;

export const getUserBalance = async (): Promise<UserBalance> => {
  const now = Date.now();
  if (userBalanceCache && now - userBalanceCache.fetchedAt < ACCOUNT_STATUS_CACHE_TTL_MS) {
    return userBalanceCache.value;
  }
  if (userBalanceErrorCache && now - userBalanceErrorCache.fetchedAt < ACCOUNT_STATUS_CACHE_TTL_MS) {
    throw userBalanceErrorCache.error;
  }
  if (userBalanceRequest) {
    return userBalanceRequest;
  }

  userBalanceRequest = fetchUserBalance()
    .then((dto) => {
      const balance: UserBalance = {
        balance: dto.balance,
      };

      userBalanceCache = { value: balance, fetchedAt: Date.now() };
      userBalanceErrorCache = null;
      return balance;
    })
    .catch((error) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      userBalanceErrorCache = { error: normalizedError, fetchedAt: Date.now() };
      throw normalizedError;
    })
    .finally(() => {
      userBalanceRequest = null;
    });

  return userBalanceRequest;
};

export const usersService = {
  getUserBalance,
};

export type UsersService = typeof usersService;
