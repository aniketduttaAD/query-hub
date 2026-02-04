const DB_NAME = 'queryhub-storage';
const STORE_NAME = 'keyval';

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getFromStore = async (key: string): Promise<string | null> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

const setInStore = async (key: string, value: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

const removeFromStore = async (key: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
};

export const createIndexedDbStorage = (storageKey: string) => ({
  getItem: async (name: string) => {
    const key = `${storageKey}:${name}`;
    const value = await getFromStore(key);
    if (value !== null) return value;

    if (typeof window !== 'undefined') {
      const legacyValue = window.localStorage.getItem(name);
      if (legacyValue !== null) {
        await setInStore(key, legacyValue);
        window.localStorage.removeItem(name);
        return legacyValue;
      }
    }

    return null;
  },
  setItem: async (name: string, value: string) => {
    const key = `${storageKey}:${name}`;
    await setInStore(key, value);
  },
  removeItem: async (name: string) => {
    const key = `${storageKey}:${name}`;
    await removeFromStore(key);
  },
});
