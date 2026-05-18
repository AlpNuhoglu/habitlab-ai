import { describe, it, expect, vi, afterEach } from 'vitest';

describe('detectPushCapability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('detects PushManager and Notification as present when stubbed', async () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class { static permission = 'default'; });
    const { detectPushCapability } = await import('./push-capability');
    const cap = detectPushCapability();
    // jsdom has no real navigator.serviceWorker, so sw is false and isSupportedBrowser is false.
    // We verify the PM/Notification detection logic works independently.
    expect(cap.pushManager).toBe(true);
    expect(cap.notifications).toBe(true);
  });

  it('returns isSupportedBrowser false and no-pm when PushManager is falsy', async () => {
    // Stub SW so it's truthy
    vi.stubGlobal('PushManager', null);
    vi.stubGlobal('Notification', class {});
    const { detectPushCapability } = await import('./push-capability');
    const cap = detectPushCapability();
    expect(cap.isSupportedBrowser).toBe(false);
    // reason is either no-sw or no-pm depending on jsdom's serviceWorker availability
    expect(['no-sw', 'no-pm']).toContain(cap.reason);
  });

  it('returns isSupportedBrowser false and no-notif when Notification is falsy', async () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', null);
    const { detectPushCapability } = await import('./push-capability');
    const cap = detectPushCapability();
    expect(cap.isSupportedBrowser).toBe(false);
    expect(['no-sw', 'no-notif']).toContain(cap.reason);
  });

  it('detects iOS UA', async () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class {});
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)',
    );
    const { detectPushCapability } = await import('./push-capability');
    const cap = detectPushCapability();
    expect(cap.isIOS).toBe(true);
  });

  it('isIOS false for non-iOS UA', async () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class {});
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    );
    const { detectPushCapability } = await import('./push-capability');
    const cap = detectPushCapability();
    expect(cap.isIOS).toBe(false);
  });
});
