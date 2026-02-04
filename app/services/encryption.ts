const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const STORAGE_KEY_ID = 'queryhub-encryption-key-id';
const DB_NAME = 'db-playground-keys';
const STORE_NAME = 'keys';

class EncryptionService {
  private keyPromise: Promise<CryptoKey> | null = null;

  private getStorageKeyId(): string {
    if (typeof window === 'undefined') {
      return STORAGE_KEY_ID;
    }

    const existing = window.localStorage.getItem(STORAGE_KEY_ID);
    if (existing) {
      return existing;
    }

    const generated = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY_ID, generated);
    return generated;
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeKey(key: CryptoKey): Promise<void> {
    const exportedKey = await crypto.subtle.exportKey('jwk', key);
    const db = await this.openDatabase();
    const storageKey = this.getStorageKeyId();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id: storageKey, key: exportedKey });

      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  private async retrieveKeyFromStorage(): Promise<CryptoKey | null> {
    try {
      const db = await this.openDatabase();
      const storageKey = this.getStorageKeyId();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(storageKey);

        request.onsuccess = async () => {
          db.close();
          if (request.result) {
            try {
              const key = await crypto.subtle.importKey(
                'jwk',
                request.result.key,
                { name: ALGORITHM },
                true,
                ['encrypt', 'decrypt'],
              );
              resolve(key);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch {
      return null;
    }
  }

  async getOrCreateKey(): Promise<CryptoKey> {
    if (this.keyPromise) {
      return this.keyPromise;
    }

    this.keyPromise = (async () => {
      const existingKey = await this.retrieveKeyFromStorage();
      if (existingKey) return existingKey;

      const key = await crypto.subtle.generateKey(
        {
          name: ALGORITHM,
          length: KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt'],
      );

      await this.storeKey(key);
      return key;
    })();

    return this.keyPromise;
  }

  async encrypt(plaintext: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv,
      },
      key,
      data,
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
    const key = await this.getOrCreateKey();

    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv,
      },
      key,
      ciphertext,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}

export const encryptionService = new EncryptionService();
