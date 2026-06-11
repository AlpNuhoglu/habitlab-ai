import { useCurrentUser } from '../../auth/api/use-current-user';

function hour(): number {
  return new Date().getHours();
}

function greeting(): string {
  const h = hour();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardGreeting(): React.ReactElement {
  const { user } = useCurrentUser();
  const name = user?.displayName ?? user?.email.split('@')[0] ?? '';

  return (
    <div className="relative">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
        {greeting()}{name ? `, ${name}` : null}
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Here&apos;s your day at a glance.
      </p>
      <div className="absolute -top-2 -left-2 h-20 w-20 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute -top-2 -right-2 h-20 w-20 bg-cyan-500/10 rounded-full blur-3xl" />
    </div>
  );
}
