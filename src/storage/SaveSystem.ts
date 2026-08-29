// IndexedDB chunk persistence

const DB_NAME    = 'craft-craft-world';
const DB_VERSION = 1;
const STORE_NAME = 'chunks';

export class SaveSystem {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveChunk(cx: number, cz: number, voxels: Uint8Array): Promise<void> {
    if (!this.db) return;
    const key = `${cx},${cz}`;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      // Copy to regular ArrayBuffer for structured clone
      const copy = new Uint8Array(voxels.length);
      copy.set(voxels);
      const req = store.put({ key, voxels: copy.buffer });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async loadChunk(cx: number, cz: number): Promise<Uint8Array | null> {
    if (!this.db) return null;
    const key = `${cx},${cz}`;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          resolve(new Uint8Array(req.result.voxels as ArrayBuffer));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteChunk(cx: number, cz: number): Promise<void> {
    if (!this.db) return;
    const key = `${cx},${cz}`;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }
}