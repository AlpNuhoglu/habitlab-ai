import { useRef } from 'react';

export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

export function generateIdempotencyKey(): IdempotencyKey {
  return crypto.randomUUID() as IdempotencyKey;
}

// Per-mutation lifecycle: key is created on first getOrCreateKey() call,
// cleared in onSettled so the next mutation.mutate() gets a fresh key.
export function useMutationIdempotency() {
  const keyRef = useRef<IdempotencyKey | null>(null);
  return {
    getOrCreateKey(): IdempotencyKey {
      if (!keyRef.current) keyRef.current = generateIdempotencyKey();
      return keyRef.current;
    },
    clearKey(): void {
      keyRef.current = null;
    },
  };
}
