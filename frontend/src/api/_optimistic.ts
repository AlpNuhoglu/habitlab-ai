import type { QueryClient, QueryKey } from '@tanstack/react-query';

export interface OptimisticOptions<TSnapshot> {
  readonly keys: QueryKey[];
  readonly apply: (queryClient: QueryClient) => TSnapshot;
  readonly invalidate: QueryKey[];
}

export interface OptimisticHandlers<TSnapshot> {
  onMutate: () => Promise<TSnapshot>;
  onError: (_err: unknown, _vars: unknown, snapshot: TSnapshot | undefined) => void;
  onSettled: () => Promise<void>;
}

export function withOptimistic<TSnapshot>(
  queryClient: QueryClient,
  options: OptimisticOptions<TSnapshot>,
): OptimisticHandlers<TSnapshot> {
  return {
    onMutate: async () => {
      await Promise.all(options.keys.map((key) => queryClient.cancelQueries({ queryKey: key })));
      return options.apply(queryClient);
    },
    onError: (_err, _vars, snapshot) => {
      if (snapshot !== undefined) {
        // restore is handled by the caller via the snapshot
        void snapshot;
      }
    },
    onSettled: async () => {
      await Promise.all(
        options.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
    },
  };
}
