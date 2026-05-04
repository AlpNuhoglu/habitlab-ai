import { Outlet } from 'react-router-dom';

export function AuthLayout(): React.ReactElement {
  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel — hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 lg:w-2/5 bg-gradient-to-br from-navy-900 via-navy-700 to-navy-500 flex-col justify-between p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">
            HL
          </div>
          <span className="font-semibold text-lg tracking-tight">HabitLab AI</span>
        </div>

        <div className="space-y-4">
          <blockquote className="text-2xl font-medium leading-snug">
            &ldquo;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&rdquo;
          </blockquote>
          <p className="text-navy-200 text-sm">— Aristotle</p>
        </div>

        <p className="text-navy-300 text-xs">
          AI-powered habit tracking and behavioural analytics.
        </p>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center font-bold text-white text-sm">
              HL
            </div>
            <span className="font-semibold text-navy-700 text-lg">HabitLab AI</span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
