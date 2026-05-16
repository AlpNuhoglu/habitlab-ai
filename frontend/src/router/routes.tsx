import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppLayout } from '../components/AppLayout';
import { AuthLayout } from '../features/auth/components/AuthLayout';
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { LogoutPage } from '../features/auth/pages/LogoutPage';
import { RegisterCheckEmailPage } from '../features/auth/pages/RegisterCheckEmailPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage';
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { HabitsPage } from '../features/habits/pages/HabitsPage';
import { HabitDetailPage } from '../features/habits/pages/HabitDetailPage';
import { TrackerPage } from '../features/tracking/pages/TrackerPage';
import { AnalyticsPage } from '../features/analytics/pages/AnalyticsPage';
import { CoachPage } from '../features/recommendations/pages/CoachPage';
import { SettingsPage } from '../features/settings/pages/SettingsPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';


export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },

  // Logout — no auth guard
  { path: '/logout', element: <LogoutPage /> },

  // Public-only routes
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

  // Protected routes — wrapped in AppLayout for nav
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/habits',    element: <HabitsPage /> },
          { path: '/habits/:id', element: <HabitDetailPage /> },
          { path: '/track',     element: <TrackerPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/coach',     element: <CoachPage /> },
          { path: '/settings',  element: <SettingsPage /> },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
