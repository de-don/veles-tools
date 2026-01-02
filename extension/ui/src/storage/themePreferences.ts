import { readStorageValue, writeStorageValue } from '../lib/safeStorage';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'veles-theme-mode';

const normalizeThemeMode = (value: string | null): ThemeMode => {
  return value === 'dark' ? 'dark' : 'light';
};

export const readThemeMode = (): ThemeMode => {
  return normalizeThemeMode(readStorageValue(THEME_STORAGE_KEY));
};

export const writeThemeMode = (mode: ThemeMode): void => {
  writeStorageValue(THEME_STORAGE_KEY, mode);
};
