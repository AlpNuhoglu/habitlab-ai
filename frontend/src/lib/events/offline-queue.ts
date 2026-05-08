import type { ClientEventEnvelope } from './client-event';

const DB_NAME = 'habitlab-events';
const DB_VERSION = 1;
const STORE_NAME = 'pending-batches';
const MAX_EVENTS = 1000;

interface StoredBatch {
  id?: number; // autoIncrement — ascending order = oldest first
  events: ClientEventEnvelope[];
  count: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function countTotalEvents(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    let total = 0;
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c) {
        total += (c.value as StoredBatch).count;
        c.continue();
      } else {
        resolve(total);
      }
    };
    cursor.onerror = () => reject(cursor.error);
  });
}

async function trimOldest(db: IDBDatabase, excess: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let removed = 0;
    const cursor = store.openCursor(); // ascending id = oldest first
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (c && removed < excess) {
        const batch = c.value as StoredBatch;
        removed += batch.count;
        c.delete();
        c.continue();
      } else {
        resolve();
      }
    };
    cursor.onerror = () => reject(cursor.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueOffline(events: ClientEventEnvelope[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return; // graceful degrade in SSR/private browsing
  try {
    const db = await openDb();
    const batch: StoredBatch = { events, count: events.length };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(batch);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const total = await countTotalEvents(db);
    if (total > MAX_EVENTS) {
      await trimOldest(db, total - MAX_EVENTS);
    }

    db.close();
  } catch {
    // IDB unavailable (private browsing, quota exceeded) — in-memory only, events lost on unload
  }
}

export async function drainOffline(): Promise<ClientEventEnvelope[][]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDb();
    const batches: ClientEventEnvelope[][] = [];

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (c) {
          batches.push((c.value as StoredBatch).events);
          c.delete();
          c.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
    return batches;
  } catch {
    return [];
  }
}
