import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';
import { EmailField } from '../components/EmailField';
import { FormError } from '../components/FormError';
import { SubmitButton } from '../components/SubmitButton';
import { useRequestReset } from '../api/use-request-reset';
import { RequestResetSchema, type RequestResetValues } from '../schema/request-reset.schema';

const FOOTER_LINKS = [{ label: 'Back to sign in', to: '/login' }];

export function ForgotPasswordPage(): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestResetValues>({ resolver: zodResolver(RequestResetSchema) });

  const requestReset = useRequestReset();

  function onSubmit(values: RequestResetValues): void {
    requestReset.mutate(values);
  }

  if (requestReset.isSuccess) {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
            <p className="mt-1 text-sm text-gray-500">
              {"If that email address is registered, we've sent a password reset link."}
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
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          {"Enter your email and we'll send you a link."}
        </p>
      </div>

      <FormError error={requestReset.error} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <EmailField registration={register('email')} error={errors.email} />

        <div className="pt-1">
          <SubmitButton
            isPending={requestReset.isPending}
            label="Send reset link"
            pendingLabel="Sending…"
          />
        </div>
      </form>

      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
