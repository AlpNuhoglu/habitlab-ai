import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AuthLayout } from '../features/auth/components/AuthLayout';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { LogoutPage } from '../features/auth/pages/LogoutPage';
import { RegisterCheckEmailPage } from '../features/auth/pages/RegisterCheckEmailPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

function PlaceholderPage({ title }: { readonly title: string }): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-400">{title} — coming in WP3+</p>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  // Logout — no auth guard, must be reachable from any state
  { path: '/logout', element: <LogoutPage /> },

  // Public-only routes: redirect to /dashboard if already authenticated
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/register/check-email', element: <RegisterCheckEmailPage /> },
          { path: '/verify-email', element: <VerifyEmailPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
        ],
      },
    ],
  },

  // Protected routes: redirect to /login if not authenticated
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <PlaceholderPage title="Dashboard" /> },
      { path: '/habits', element: <PlaceholderPage title="Habits" /> },
      { path: '/habits/:id', element: <PlaceholderPage title="Habit detail" /> },
      { path: '/analytics', element: <PlaceholderPage title="Analytics" /> },
      { path: '/settings', element: <PlaceholderPage title="Settings" /> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
