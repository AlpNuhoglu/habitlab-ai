import { useCurrentUser } from '../../auth/api/use-current-user';
import { useUpdateOptOut } from '../api/use-update-opt-out';

export function OptOutToggle(): React.ReactElement {
  const { user } = useCurrentUser();
  const updateOptOut = useUpdateOptOut();

  const optedOut = user?.preferences.experiments_opted_out ?? false;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    updateOptOut.mutate(e.target.checked);
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 items-center">
        <input
          id="experiments-opt-out"
          type="checkbox"
          checked={optedOut}
          onChange={handleChange}
          disabled={updateOptOut.isPending || !user}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:opacity-50"
        />
      </div>
      <div className="text-sm">
        <label htmlFor="experiments-opt-out" className="font-medium text-gray-900">
          Standard experience
        </label>
        <p className="text-gray-500">
          Show the standard experience for new features instead of trial versions. You can
          change this any time.
        </p>
      </div>
    </div>
  );
}
