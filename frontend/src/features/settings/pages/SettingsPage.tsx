import { OptOutToggle } from '../../experiments/components/OptOutToggle';

export function SettingsPage(): React.ReactElement {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account preferences</p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Experiments</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          Control whether you participate in feature experiments.
        </p>
        <OptOutToggle />
      </section>
    </div>
  );
}
