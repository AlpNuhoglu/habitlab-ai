// Locked-in SSE seam — signature is fixed; implementation is a no-op stub until
// a future WP wires up GET /api/v1/events/stream. Component call sites do not change
// when the real implementation lands.

type RealtimeHandler<T> = (event: T) => void;

interface UseRealtimeOptions<T> {
  channel: string;
  onEvent: RealtimeHandler<T>;
  enabled?: boolean;
}

export function useRealtime<T>(_options: UseRealtimeOptions<T>): {
  isConnected: boolean;
  disconnect: () => void;
} {
  return { isConnected: false, disconnect: () => undefined };
}
