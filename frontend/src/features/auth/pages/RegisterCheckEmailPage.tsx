import { AuthCard } from '../components/AuthCard';
import { AuthFooter } from '../components/AuthFooter';

const FOOTER_LINKS = [{ label: 'Back to sign in', to: '/login' }];

export function RegisterCheckEmailPage(): React.ReactElement {
  return (
    <AuthCard>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-navy-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Check your inbox</h2>
          <p className="mt-1 text-sm text-gray-500">
            {"We've sent a verification link to your email address. Click it to activate your account."}
          </p>
        </div>
      </div>
      <AuthFooter links={FOOTER_LINKS} />
    </AuthCard>
  );
}
