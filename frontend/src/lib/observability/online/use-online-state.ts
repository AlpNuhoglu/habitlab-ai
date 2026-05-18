import { useSyncExternalStore } from 'react';

let listeners: Array<() => void> = [];

function subscribeOnline(cb: () => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => listeners.forEach((l) => l()));
  window.addEventListener('offline', () => listeners.forEach((l) => l()));
}

export function useOnlineState(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
}
