import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';
import { useVerifyEmail } from '../api/use-verify-email';

const FOOTER_LINKS = [{ label: 'Back to sign in', to: '/login' }];

export function VerifyEmailPage(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const verify = useVerifyEmail();
  // Guard against StrictMode double-effect: mutate fires exactly once.
  const didFire = useRef(false);

  useEffect(() => {
    if (!token || didFire.current) return;
    didFire.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (verify.isPending || verify.isIdle) {
    return (
      <AuthCard>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <svg
            className="h-8 w-8 animate-spin text-navy-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Verifying your email…</p>
        </div>
        <AuthFooter links={FOOTER_LINKS} />
      </AuthCard>
    );
  }

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
          <h2 className="text-lg font-semibold text-gray-900">Verification failed</h2>
          <p className="mt-1 text-sm text-gray-500">
            This link is invalid or has already been used. Request a new one below.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Resend verification is not yet available"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed opacity-60"
        >
          Resend verification email
        </button>
      </div>
      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
