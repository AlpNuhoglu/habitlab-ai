import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';

import { ApiException } from '../../../api/client';
import { mapApiError } from '../lib/error-mapper';

interface FormErrorProps {
  readonly error: unknown;
}

export function FormError({ error }: FormErrorProps): React.ReactElement | null {
  if (!error) return null;

  const apiError =
    error instanceof ApiException ? error.error : null;
  const message = apiError
    ? mapApiError(apiError).userMessage
    : 'An unexpected error occurred. Please try again.';

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

/**
 * Maps server-side validation field errors onto react-hook-form fields.
 * Call this in mutation onError when kind === 'validation'.
 */
export function applyValidationErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): void {
  if (!(error instanceof ApiException)) return;
  if (error.error.kind !== 'validation') return;
  for (const [field, messages] of Object.entries(error.error.fields)) {
    const msg = messages[0];
    if (msg) setError(field as Path<T>, { message: msg });
  }
}
