import { useEffect } from 'react';
import { toast } from '../../../hooks/use-toast';
import { onPushMessage } from '../lib/push-channel';

interface PushPayload {
  title?: string;
  body?: string;
}

export function PushToast(): null {
  useEffect(() => {
    // SW forwards push events to visible clients via the push-channel PUSH_RECEIVED message.
    return onPushMessage((msg) => {
      if (msg.type !== 'PUSH_RECEIVED') return;
      const p = msg.payload as PushPayload | null;
      const text = p?.title ?? 'New notification';
      const body = p?.body;
      toast(`${text}${body ? ` — ${body}` : ''}`, 'info');
    });
  }, []);

  return null;
}
