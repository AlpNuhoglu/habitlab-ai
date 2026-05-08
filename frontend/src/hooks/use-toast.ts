import { useState, useCallback } from 'react';

export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly variant: 'success' | 'error' | 'info';
}

let _nextId = 0;

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: Toast['variant']) => void;
  removeToast: (id: string) => void;
}

// Module-level singleton — avoids prop-drilling while remaining framework-free.
// One day this can be replaced with a proper Context if needed.
let _setState: ((updater: (prev: Toast[]) => Toast[]) => void) | null = null;

export function useToastQueue(): ToastState {
  const [toasts, setToasts] = useState<Toast[]>([]);
  _setState = setToasts;

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: Toast['variant'] = 'info') => {
      const id = String(++_nextId);
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  return { toasts, addToast, removeToast };
}

/** Fire-and-forget toast from outside React tree (e.g. in mutation callbacks). */
export function toast(message: string, variant: Toast['variant'] = 'info'): void {
  if (!_setState) return;
  const id = String(++_nextId);
  _setState((prev) => [...prev, { id, message, variant }]);
  setTimeout(() => {
    _setState?.((prev) => prev.filter((t) => t.id !== id));
  }, 4000);
}
