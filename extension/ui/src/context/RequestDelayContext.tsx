import { createContext, useContext } from 'react';

export interface RequestDelayContextValue {
  delayMs: number;
  setDelayMs: (value: number) => void;
  defaultDelayMs: number;
}

const RequestDelayContext = createContext<RequestDelayContextValue | null>(null);

export const RequestDelayProvider = RequestDelayContext.Provider;

export const useRequestDelay = (): RequestDelayContextValue => {
  const context = useContext(RequestDelayContext);
  if (!context) {
    throw new Error('RequestDelayContext is unavailable');
  }
  return context;
};
