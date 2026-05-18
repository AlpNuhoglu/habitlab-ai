interface Props {
  onEnable: () => void;
  onDismiss: () => void;
}

export function PermissionPrimer({ onEnable, onDismiss }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
      <h3 className="text-base font-semibold text-indigo-900">Get habit reminders</h3>
      <p className="mt-2 text-sm text-indigo-800">
        We&apos;ll send a notification at the time you set for each habit, respecting your quiet hours.
        We never send marketing — just your reminders.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onEnable}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Enable reminders
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
