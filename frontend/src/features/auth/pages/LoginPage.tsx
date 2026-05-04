import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';

import { ApiException } from '../../../api/client';
import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';
import { EmailField } from '../components/EmailField';
import { FormError, applyValidationErrors } from '../components/FormError';
import { PasswordField } from '../components/PasswordField';
import { SubmitButton } from '../components/SubmitButton';
import { VariantSlot } from '../components/VariantSlot';
import { useLogin } from '../api/use-login';
import { useResendVerification } from '../api/use-resend-verification';
import { LoginSchema, type LoginValues } from '../schema/login.schema';

const FOOTER_LINKS = [
  { label: 'Create an account', to: '/register' },
  { label: 'Forgot password?', to: '/forgot-password' },
];

export function LoginPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  const isVerified = searchParams.get('verified') === '1';
  const isPasswordReset = searchParams.get('passwordReset') === '1';
  const isExpired = searchParams.get('reason') === 'expired';

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) });

  const login = useLogin();
  const resendVerification = useResendVerification();
  const emailValue = watch('email');

  // Rate-limit countdown
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;
    const id = setInterval(() => setRateLimitSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [rateLimitSeconds]);

  function onSubmit(values: LoginValues): void {
    login.mutate(values, {
      onError: (err) => {
        if (!(err instanceof ApiException)) return;
        if (err.error.kind === 'rate_limited') {
          setRateLimitSeconds(err.error.retryAfterSec);
        }
        applyValidationErrors(err, setError);
      },
    });
  }

  const isForbidden =
    login.error instanceof ApiException && login.error.error.kind === 'forbidden';

  return (
    <AuthCard>
      <div className="mb-6">
        <VariantSlot id="auth.login.headline">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        </VariantSlot>
        <p className="mt-1 text-sm text-gray-500">Sign in to your HabitLab account.</p>
      </div>

      {isVerified && (
        <div role="status" className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Email verified — you can now sign in.
        </div>
      )}
      {isPasswordReset && (
        <div role="status" className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Password reset successfully. Please sign in.
        </div>
      )}
      {isExpired && (
        <div role="status" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Your session expired. Please sign in again.
        </div>
      )}

      {isForbidden ? (
        <div role="alert" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          <p className="font-medium">Email not verified</p>
          <p className="mt-1">Check your inbox for a verification link.</p>
          {resendVerification.isSuccess ? (
            <p className="mt-2 text-xs font-medium">Verification email sent — check your inbox.</p>
          ) : (
            <button
              type="button"
              disabled={resendVerification.isPending || !emailValue}
              onClick={() => resendVerification.mutate({ email: emailValue })}
              className="mt-2 text-amber-700 underline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendVerification.isPending ? 'Sending…' : 'Resend verification email'}
            </button>
          )}
        </div>
      ) : (
        <FormError error={login.error} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <EmailField registration={register('email')} error={errors.email} />
        <PasswordField
          registration={register('password')}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="pt-1">
          <SubmitButton
            isPending={login.isPending || rateLimitSeconds > 0}
            label="Sign in"
            pendingLabel={
              rateLimitSeconds > 0 ? `Wait ${rateLimitSeconds}s…` : 'Signing in…'
            }
          />
        </div>
      </form>

      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
