import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { saveSubscription, getSubscription, clearSubscription } from './subscription-store';

// Mock apiFetch so reconciliation doesn't make real network calls.
vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
  ApiException: class extends Error {},
}));

import { apiFetch } from '../../../api/client';
const mockFetch = apiFetch as ReturnType<typeof vi.fn>;

function makeBrowserSub(endpoint: string): PushSubscription {
  return {
    endpoint,
    expirationTime: null,
    toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
    getKey: vi.fn(),
    options: { applicationServerKey: null, userVisibleOnly: true },
  } as unknown as PushSubscription;
}

function setupSwReady(browserSub: PushSubscription | null): void {
  const reg = {
    pushManager: {
      getSubscription: vi.fn().mockResolvedValue(browserSub),
      subscribe: vi.fn(),
    },
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(reg),
    },
  });
}

describe('reconcileLocalSubscription', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await clearSubscription();
    mockFetch.mockResolvedValue({ id: 'new-id', endpoint: 'x', createdAt: '', userAgent: null });
  });

  it('does nothing when both IDB and browser are empty', async () => {
    setupSwReady(null);
    const { reconcileLocalSubscription } = await import('./reconcile-subscription');
    await reconcileLocalSubscription('user-1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('clears IDB and DELETEs backend when browser has no subscription', async () => {
    await saveSubscription({ id: 'stale-id', endpoint: 'https://old.com', expirationTime: null });
    setupSwReady(null);
    const { reconcileLocalSubscription } = await import('./reconcile-subscription');
    await reconcileLocalSubscription('user-1');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('stale-id'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(await getSubscription()).toBeNull();
  });

  it('POSTs and saves when browser has subscription but IDB is empty', async () => {
    setupSwReady(makeBrowserSub('https://new.com'));
    mockFetch.mockResolvedValue({ id: 'new-id', endpoint: 'https://new.com', createdAt: '', userAgent: null });
    const { reconcileLocalSubscription } = await import('./reconcile-subscription');
    await reconcileLocalSubscription('user-1');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/notifications/subscriptions',
      expect.objectContaining({ method: 'POST' }),
    );
    const stored = await getSubscription();
    expect(stored?.id).toBe('new-id');
  });

  it('rotates when endpoints diverge', async () => {
    await saveSubscription({ id: 'old-id', endpoint: 'https://old.com', expirationTime: null });
    setupSwReady(makeBrowserSub('https://new.com'));
    mockFetch
      .mockResolvedValueOnce(undefined) // DELETE returns void
      .mockResolvedValueOnce({ id: 'rotated-id', endpoint: 'https://new.com', createdAt: '', userAgent: null });
    const { reconcileLocalSubscription } = await import('./reconcile-subscription');
    await reconcileLocalSubscription('user-1');
    const stored = await getSubscription();
    expect(stored?.id).toBe('rotated-id');
  });
});
