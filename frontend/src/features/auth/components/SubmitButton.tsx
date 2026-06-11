interface SubmitButtonProps {
  readonly isPending: boolean;
  readonly label: string;
  readonly pendingLabel?: string;
}

export function SubmitButton({
  isPending,
  label,
  pendingLabel = 'Please wait…',
}: SubmitButtonProps): React.ReactElement {
  return (
    <button
      type="submit"
      disabled={isPending}
      aria-busy={isPending}
      className={[
        'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
        'text-sm font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
        isPending
          ? 'border border-purple-500/20 bg-purple-900/20 text-purple-400/50 cursor-not-allowed'
          : 'border border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]',
      ].join(' ')}
    >
      {isPending && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {isPending ? pendingLabel : label}
    </button>
  );
}
