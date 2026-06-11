import { Outlet } from 'react-router-dom';

export function AuthLayout(): React.ReactElement {
  return (
    <div className="min-h-screen flex bg-black">
      {/* Left panel */}
      <div className="hidden md:flex md:w-1/2 lg:w-2/5 bg-gradient-to-br from-black via-gray-950 to-purple-950/50 border-r border-purple-500/20 flex-col justify-between p-10 text-white relative overflow-hidden">
        {/* Ambient glows */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <div className="relative flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border border-purple-500/50 bg-purple-500/10 flex items-center justify-center font-bold text-sm text-purple-400">
            HL
          </div>
          <span className="font-bold text-lg tracking-widest uppercase bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            HabitLab AI
          </span>
        </div>

        <div className="relative space-y-4">
          <blockquote className="text-2xl font-medium leading-snug text-gray-200">
            &ldquo;We are what we repeatedly do. Excellence, then, is not an act, but a habit.&rdquo;
          </blockquote>
          <p className="text-gray-500 text-sm">— Aristotle</p>
        </div>

        <p className="relative text-gray-600 text-xs tracking-wider uppercase">
          AI-powered habit tracking and behavioural analytics.
        </p>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex items-center justify-center bg-black px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 mb-8 md:hidden">
            <div className="w-8 h-8 rounded-lg border border-purple-500/50 bg-purple-500/10 flex items-center justify-center font-bold text-purple-400 text-sm">
              HL
            </div>
            <span className="font-bold tracking-widest uppercase bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent text-lg">
              HabitLab AI
            </span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
