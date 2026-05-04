import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';

import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';
import { FormError, applyValidationErrors } from '../components/FormError';
import { PasswordField } from '../components/PasswordField';
import { SubmitButton } from '../components/SubmitButton';
import { useResetPassword } from '../api/use-reset-password';
import { ResetPasswordSchema, type ResetPasswordValues } from '../schema/reset-password.schema';

const FOOTER_LINKS = [{ label: 'Back to sign in', to: '/login' }];

export function ResetPasswordPage(): React.ReactElement {
  // useSearchParams reads from React Router's state machine — stable across
  // StrictMode double-invocations, unlike window.location reads in effects.
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  const resetPassword = useResetPassword();
  const passwordValue = watch('newPassword');

  function onSubmit(values: ResetPasswordValues): void {
    resetPassword.mutate(
      { ...values, token },
      { onError: (err) => applyValidationErrors(err, setError) },
    );
  }

  if (!token) {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Invalid reset link</h2>
            <p className="mt-1 text-sm text-gray-500">
              This link is missing a token. Request a new one from the forgot-password page.
            </p>
          </div>
        </div>
        <AuthFooter links={FOOTER_LINKS} />
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Must be at least 8 characters with a letter and a digit.
        </p>
      </div>

      <FormError error={resetPassword.error} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <PasswordField
          registration={register('newPassword')}
          error={errors.newPassword}
          label="New password"
          autoComplete="new-password"
          showStrength
          watchValue={passwordValue}
        />
        <PasswordField
          registration={register('confirmPassword')}
          error={errors.confirmPassword}
          label="Confirm new password"
          autoComplete="new-password"
        />

        <div className="pt-1">
          <SubmitButton
            isPending={resetPassword.isPending}
            label="Set new password"
            pendingLabel="Saving…"
          />
        </div>
      </form>

      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
