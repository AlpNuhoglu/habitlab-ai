import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveSubscription, getSubscription, clearSubscription } from './subscription-store';

describe('subscription-store', () => {
  beforeEach(async () => {
    await clearSubscription();
  });

  it('returns null when nothing is stored', async () => {
    expect(await getSubscription()).toBeNull();
  });

  it('saves and retrieves a subscription', async () => {
    await saveSubscription({ id: 'abc', endpoint: 'https://ex.com', expirationTime: null });
    const s = await getSubscription();
    expect(s?.id).toBe('abc');
    expect(s?.endpoint).toBe('https://ex.com');
    expect(s?.expirationTime).toBeNull();
  });

  it('clear removes the stored subscription', async () => {
    await saveSubscription({ id: 'xyz', endpoint: 'https://ex.com', expirationTime: null });
    await clearSubscription();
    expect(await getSubscription()).toBeNull();
  });

  it('overwrites with save', async () => {
    await saveSubscription({ id: 'first', endpoint: 'https://a.com', expirationTime: null });
    await saveSubscription({ id: 'second', endpoint: 'https://b.com', expirationTime: 1234 });
    const s = await getSubscription();
    expect(s?.id).toBe('second');
    expect(s?.endpoint).toBe('https://b.com');
    expect(s?.expirationTime).toBe(1234);
  });
});
