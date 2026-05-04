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
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
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
          'block w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400',
          'shadow-sm transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500',
          error
            ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
            : 'border-gray-300 bg-white hover:border-gray-400',
        ].join(' ')}
        placeholder="you@example.com"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 mt-1">
          {error.message}
        </p>
      )}
    </div>
  );
}
