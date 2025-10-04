export interface IndexedDbConfig {
  name: string;
  version: number;
  upgrade: (database: IDBDatabase, event: IDBVersionChangeEvent) => void;
}

const connections = new Map<string, Promise<IDBDatabase>>();

export const isIndexedDbAvailable = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }
  return typeof window.indexedDB !== 'undefined';
};

export const openIndexedDb = (config: IndexedDbConfig): Promise<IDBDatabase> => {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB недоступен в этом окружении.'));
  }

  const cacheKey = `${config.name}::${config.version}`;
  const existing = connections.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(config.name, config.version);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      try {
        config.upgrade(database, event);
      } catch (error) {
        console.warn('[IndexedDB] Ошибка в upgrade обработчике', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        connections.delete(cacheKey);
      };
      resolve(database);
    };

    request.onerror = () => {
      connections.delete(cacheKey);
      reject(request.error ?? new Error('Не удалось открыть IndexedDB.'));
    };

    request.onblocked = () => {
      console.warn('[IndexedDB] Запрос заблокирован другой вкладкой.');
    };
  });

  connections.set(cacheKey, promise);
  return promise;
};

export const getObjectStore = async (
  config: IndexedDbConfig,
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore | null> => {
  if (!isIndexedDbAvailable()) {
    return null;
  }

  try {
    const database = await openIndexedDb(config);
    const transaction = database.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  } catch (error) {
    console.warn('[IndexedDB] Ошибка получения object store', error);
    return null;
  }
};

export const deleteIndexedDb = async (name: string): Promise<void> => {
  if (!isIndexedDbAvailable()) {
    return;
  }

  connections.forEach((promise, key) => {
    if (key.startsWith(`${name}::`)) {
      connections.delete(key);
      promise
        .then((database) => {
          try {
            database.close();
          } catch (error) {
            console.warn('[IndexedDB] Ошибка закрытия базы при очистке', error);
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
  });

  await new Promise<void>((resolve) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      console.warn('[IndexedDB] Не удалось удалить базу', request.error);
      resolve();
    };
    request.onblocked = () => {
      console.warn('[IndexedDB] Удаление базы заблокировано другой вкладкой.');
    };
  });
};
