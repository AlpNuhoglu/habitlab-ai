import { getVapidPublicKey } from './vapid-key';

export async function subscribeToPush(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key = getVapidPublicKey();
  // Cast through ArrayBuffer to satisfy the DOM type (ArrayBufferView<ArrayBuffer>).
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer,
  });
}
