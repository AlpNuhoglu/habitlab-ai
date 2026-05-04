import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';
import { EmailField } from '../components/EmailField';
import { FormError, applyValidationErrors } from '../components/FormError';
import { PasswordField } from '../components/PasswordField';
import { SubmitButton } from '../components/SubmitButton';
import { VariantSlot } from '../components/VariantSlot';
import { useRegister } from '../api/use-register';
import { RegisterSchema, type RegisterValues } from '../schema/register.schema';

const FOOTER_LINKS = [{ label: 'Already have an account? Sign in', to: '/login' }];

export function RegisterPage(): React.ReactElement {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { acceptTos: false },
  });

  const signup = useRegister();
  const passwordValue = watch('password');

  function onSubmit(values: RegisterValues): void {
    signup.mutate(values, {
      onError: (err) => applyValidationErrors(err, setError),
    });
  }

  return (
    <AuthCard>
      <div className="mb-6">
        <VariantSlot id="auth.register.headline">
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        </VariantSlot>
        <p className="mt-1 text-sm text-gray-500">Start building better habits today.</p>
      </div>

      <FormError error={signup.error} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 space-y-4">
        <EmailField registration={register('email')} error={errors.email} />

        <PasswordField
          registration={register('password')}
          error={errors.password}
          label="Password"
          autoComplete="new-password"
          showStrength
          watchValue={passwordValue}
        />

        <PasswordField
          registration={register('passwordConfirm')}
          error={errors.passwordConfirm}
          label="Confirm password"
          autoComplete="new-password"
        />

        <div className="flex items-start gap-3">
          <input
            {...register('acceptTos')}
            id="field-acceptTos"
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-navy-700 focus:ring-navy-500 cursor-pointer"
          />
          <label htmlFor="field-acceptTos" className="text-sm text-gray-600 cursor-pointer">
            I accept the{' '}
            <span className="text-navy-700 underline">terms of service</span> and{' '}
            <span className="text-navy-700 underline">privacy policy</span>.
          </label>
        </div>
        {errors.acceptTos && (
          <p role="alert" className="text-xs text-red-600 -mt-2">
            {errors.acceptTos.message}
          </p>
        )}

        <div className="pt-1">
          <SubmitButton
            isPending={signup.isPending}
            label="Create account"
            pendingLabel="Creating account…"
          />
        </div>
      </form>

      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
