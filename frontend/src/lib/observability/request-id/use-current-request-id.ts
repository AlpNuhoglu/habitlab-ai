import { useSyncExternalStore } from 'react';
import { subscribe, getCurrentRequestId } from './request-id-store';

export function useCurrentRequestId(): string | null {
  return useSyncExternalStore(subscribe, getCurrentRequestId);
}
