import { createContext, type PropsWithChildren, useContext } from 'react';
import type { ThemeMode } from '../storage/themePreferences';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ value, children }: PropsWithChildren<{ value: ThemeContextValue }>) => {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeMode = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('ThemeContext is not available');
  }
  return context;
};
