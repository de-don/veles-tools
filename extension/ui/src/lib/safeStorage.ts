type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const resolveLocalStorage = (): StorageLike | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.warn('[Veles Tools] Доступ к localStorage недоступен', error);
    return null;
  }
};

const handleStorageError = (message: string, error: unknown) => {
  console.warn(message, error);
};

export const readStorageValue = (key: string): string | null => {
  const storage = resolveLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch (error) {
    handleStorageError(`[Veles Tools] Не удалось прочитать ключ ${key} из storage`, error);
    return null;
  }
};

export const writeStorageValue = (key: string, value: string): boolean => {
  const storage = resolveLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    handleStorageError(`[Veles Tools] Не удалось сохранить ключ ${key} в storage`, error);
    return false;
  }
};

export const removeStorageValue = (key: string): boolean => {
  const storage = resolveLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch (error) {
    handleStorageError(`[Veles Tools] Не удалось удалить ключ ${key} из storage`, error);
    return false;
  }
};
