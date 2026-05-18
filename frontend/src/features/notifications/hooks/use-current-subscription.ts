import { useEffect, useState } from 'react';
import { getSubscription, type StoredSubscription } from '../lib/subscription-store';
import { onPushMessage } from '../lib/push-channel';

interface CurrentSubscription {
  backendId: string | null;
  endpoint: string | null;
  isLoading: boolean;
}

export function useCurrentSubscription(): CurrentSubscription {
  const [stored, setStored] = useState<StoredSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  function load(): void {
    void getSubscription().then((s) => {
      setStored(s);
      setIsLoading(false);
    });
  }

  useEffect(() => {
    load();
    const unsub = onPushMessage((msg) => {
      if (msg.type === 'SUBSCRIPTION_CHANGED') load();
    });
    return unsub;
  }, []);

  return {
    backendId: stored?.id ?? null,
    endpoint: stored?.endpoint ?? null,
    isLoading,
  };
}
