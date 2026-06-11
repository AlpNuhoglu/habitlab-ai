import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface EmailFieldProps {
  readonly registration: UseFormRegisterReturn;
  readonly error?: FieldError | undefined;
  readonly label?: string;
}

export function EmailField({
  registration,
  error,
  label = 'Email address',
}: EmailFieldProps): React.ReactElement {
  const id = 'field-email';
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-400 tracking-wide">
        {label}
      </label>
      <input
        {...registration}
        id={id}
        type="email"
        autoComplete="email"
        spellCheck={false}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
        className={[
          'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-100 placeholder-gray-600',
          'bg-gray-900/60 transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
          error
            ? 'border-red-500/50 focus:ring-red-500 focus:border-red-500'
            : 'border-gray-700 hover:border-gray-600',
        ].join(' ')}
        placeholder="you@example.com"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400 mt-1">
          {error.message}
        </p>
      )}
    </div>
  );
}
