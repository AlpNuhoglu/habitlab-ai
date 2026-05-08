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
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting()}{name ? `, ${name}` : null}
      </h1>
      <p className="mt-1 text-sm text-gray-400">Here&apos;s your day at a glance.</p>
    </div>
  );
}
