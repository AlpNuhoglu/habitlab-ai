import { useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

const MAX_CHARS = 500;

export function ChatInput({ value, onChange, onSubmit, disabled }: Props): React.ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const remaining = MAX_CHARS - value.length;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  return (
    <div className="border-t border-gray-100 bg-white px-4 py-3">
      <div
        className={`flex items-end gap-2 rounded-xl border bg-gray-50 px-3 py-2 transition-colors ${
          disabled ? 'border-gray-200 opacity-60' : 'border-gray-200 focus-within:border-indigo-400 focus-within:bg-white'
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            disabled
              ? 'Your Coach is analyzing your habit data…'
              : 'Ask your AI Coach anything about your habits…'
          }
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none disabled:cursor-not-allowed"
        />

        <div className="flex shrink-0 flex-col items-end gap-1">
          {value.length > 0 && (
            <span
              className={`text-xs ${remaining <= 50 ? 'text-amber-500' : 'text-gray-400'}`}
            >
              {remaining}
            </span>
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            aria-label="Send message"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.908 6.457H13.5a.75.75 0 0 1 0 1.5H4.188l-1.908 6.457a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.208-8.187.75.75 0 0 0 0-1.132A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mt-1.5 px-1 text-xs text-gray-400">
        Press <kbd className="rounded bg-gray-100 px-1 font-mono text-xs">Enter</kbd> to send ·{' '}
        <kbd className="rounded bg-gray-100 px-1 font-mono text-xs">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
