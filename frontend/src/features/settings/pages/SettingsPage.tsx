import { Link } from 'react-router-dom';
import { OptOutToggle } from '../../experiments/components/OptOutToggle';

export function SettingsPage(): React.ReactElement {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent tracking-wide">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account preferences</p>
      </div>

      <section className="rounded-xl border border-purple-500/20 bg-gray-900/40 backdrop-blur-md p-6 hover:border-purple-400/40 transition-colors">
        <h2 className="text-base font-semibold text-gray-100 tracking-wide">Notifications</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Manage push reminders and quiet hours.
        </p>
        <Link
          to="/settings/notifications"
          className="inline-flex items-center text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          Manage notifications →
        </Link>
      </section>

      <section className="rounded-xl border border-purple-500/20 bg-gray-900/40 backdrop-blur-md p-6 hover:border-purple-400/40 transition-colors">
        <h2 className="text-base font-semibold text-gray-100 tracking-wide">Experiments</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Control whether you participate in feature experiments.
        </p>
        <OptOutToggle />
      </section>
    </div>
  );
}
