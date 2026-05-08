import { useToastQueue } from '../hooks/use-toast';

export function ToastContainer(): React.ReactElement {
  const { toasts, removeToast } = useToastQueue();

  if (toasts.length === 0) return <></>;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => removeToast(t.id)}
          className={`pointer-events-auto flex max-w-xs cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-sm transition-all ${
            t.variant === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : t.variant === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-gray-200 bg-white text-gray-800'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
