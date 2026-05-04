import { useState } from 'react';
import type { FieldError, UseFormRegisterReturn } from 'react-hook-form';

import { scorePassword, strengthColor, strengthLabel } from '../lib/password-strength';

interface PasswordFieldProps {
  readonly registration: UseFormRegisterReturn;
  readonly error?: FieldError | undefined;
  readonly label?: string;
  readonly autoComplete?: string;
  readonly showStrength?: boolean;
  readonly watchValue?: string;
}

export function PasswordField({
  registration,
  error,
  label = 'Password',
  autoComplete = 'current-password',
  showStrength = false,
  watchValue = '',
}: PasswordFieldProps): React.ReactElement {
  const [visible, setVisible] = useState(false);
  const id = `field-${registration.name}`;
  const score = showStrength ? scorePassword(watchValue) : 0;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          {...registration}
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${id}-error` : undefined}
          // Chrome autofill fires an animation instead of an input event; re-trigger
          // validation so react-hook-form sees the autofilled value.
          onAnimationStart={(e) => {
            if (e.animationName === 'onAutoFillStart') {
              void registration.ref;
            }
          }}
          className={[
            'block w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm text-gray-900',
            'shadow-sm transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500',
            error
              ? 'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400'
              : 'border-gray-300 bg-white hover:border-gray-400',
          ].join(' ')}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded-r-lg"
          tabIndex={-1}
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {showStrength && watchValue && (
        <div className="space-y-1 pt-1">
          <div className="flex gap-1" aria-hidden="true">
            {([1, 2, 3, 4] as const).map((level) => (
              <div
                key={level}
                className={[
                  'h-1 flex-1 rounded-full transition-colors duration-300',
                  score >= level ? strengthColor(score) : 'bg-gray-200',
                ].join(' ')}
              />
            ))}
          </div>
          {score > 0 && (
            <p className="text-xs text-gray-500">
              Strength: <span className="font-medium">{strengthLabel(score)}</span>
            </p>
          )}
        </div>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 mt-1">
          {error.message}
        </p>
      )}
    </div>
  );
}
