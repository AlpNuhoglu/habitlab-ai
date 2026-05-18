import { describe, it, expect, vi, beforeEach } from 'vitest';

// BroadcastChannel shim for jsdom.
class FakeBroadcastChannel extends EventTarget {
  static instances: FakeBroadcastChannel[] = [];
  name: string;
  onmessageerror: null = null;

  constructor(name: string) {
    super();
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }
  postMessage(data: unknown): void {
    // Deliver to all other instances with the same name.
    FakeBroadcastChannel.instances
      .filter((c) => c !== this && c.name === this.name)
      .forEach((c) => c.dispatchEvent(Object.assign(new Event('message'), { data })));
  }
  close(): void { /* noop */ }
}

beforeEach(() => {
  FakeBroadcastChannel.instances = [];
  (globalThis as Record<string, unknown>)['BroadcastChannel'] = FakeBroadcastChannel;
  // Reset the module so push-channel gets a fresh BroadcastChannel.
  vi.resetModules();
});

describe('push-channel', () => {
  it('delivers PERMISSION_CHANGED to listeners', async () => {
    const { onPushMessage } = await import('./push-channel');

    const received: string[] = [];
    const unsub = onPushMessage((msg) => {
      if (msg.type === 'PERMISSION_CHANGED') received.push(msg.value);
    });

    // Simulate another tab posting.
    const otherTab = new FakeBroadcastChannel('habitlab-push');
    otherTab.postMessage({ type: 'PERMISSION_CHANGED', value: 'granted' });

    await new Promise((r) => setTimeout(r, 0));

    expect(received).toContain('granted');
    unsub();
  });

  it('postPermissionChanged sends the right shape', async () => {
    const { postPermissionChanged } = await import('./push-channel');

    const msgs: unknown[] = [];
    const otherTab = new FakeBroadcastChannel('habitlab-push');
    otherTab.addEventListener('message', (e) => msgs.push((e as MessageEvent).data));

    postPermissionChanged('denied');
    await new Promise((r) => setTimeout(r, 0));

    expect(msgs).toEqual([{ type: 'PERMISSION_CHANGED', value: 'denied' }]);
    otherTab.close();
  });
});
