import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface UseDocumentTitleOptions {
  restoreOnUnmount?: boolean;
}

export interface DocumentTitleController {
  initialTitle: string | null;
  setTitle: (value: string) => void;
  resetTitle: () => void;
  getInitialTitle: () => string | null;
}

const isDocumentAvailable = (): boolean => {
  return typeof document !== 'undefined';
};

export const useDocumentTitle = (options?: UseDocumentTitleOptions): DocumentTitleController => {
  const restoreOnUnmount = options?.restoreOnUnmount !== false;
  const initialTitleRef = useRef<string | null>(null);

  const getInitialTitle = useCallback((): string | null => {
    if (!isDocumentAvailable()) {
      return null;
    }
    if (initialTitleRef.current === null) {
      initialTitleRef.current = document.title;
    }
    return initialTitleRef.current;
  }, []);

  const setTitle = useCallback(
    (value: string) => {
      if (!isDocumentAvailable()) {
        return;
      }
      getInitialTitle();
      document.title = value;
    },
    [getInitialTitle],
  );

  const resetTitle = useCallback(() => {
    if (!isDocumentAvailable()) {
      return;
    }
    const initialTitle = getInitialTitle();
    if (initialTitle !== null) {
      document.title = initialTitle;
    }
  }, [getInitialTitle]);

  useEffect(() => {
    getInitialTitle();
    if (!restoreOnUnmount) {
      return;
    }
    return () => {
      if (!isDocumentAvailable()) {
        return;
      }
      const initialTitle = initialTitleRef.current;
      if (initialTitle !== null) {
        document.title = initialTitle;
      }
    };
  }, [getInitialTitle, restoreOnUnmount]);

  return useMemo(
    () => ({
      initialTitle: initialTitleRef.current,
      setTitle,
      resetTitle,
      getInitialTitle,
    }),
    [setTitle, resetTitle, getInitialTitle],
  );
};

