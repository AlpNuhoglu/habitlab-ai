import { openDB } from 'idb';

export interface StoredSubscription {
  readonly id: string;
  readonly endpoint: string;
  readonly expirationTime: number | null;
}

function getDb() {
  return openDB('habitlab-push', 1, {
    upgrade(db) {
      db.createObjectStore('subscriptions');
    },
  });
}

export async function saveSubscription(data: StoredSubscription): Promise<void> {
  const db = await getDb();
  await db.put('subscriptions', data, 'current');
}

export async function getSubscription(): Promise<StoredSubscription | null> {
  const db = await getDb();
  const val: unknown = await db.get('subscriptions', 'current');
  if (val == null) return null;
  const s = val as Record<string, unknown>;
  if (typeof s['id'] !== 'string' || typeof s['endpoint'] !== 'string') return null;
  return {
    id: s['id'],
    endpoint: s['endpoint'],
    expirationTime: typeof s['expirationTime'] === 'number' ? s['expirationTime'] : null,
  };
}

export async function clearSubscription(): Promise<void> {
  const db = await getDb();
  await db.delete('subscriptions', 'current');
}
