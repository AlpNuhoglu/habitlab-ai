export function TypingIndicator(): React.ReactElement {
  return (
    <div className="flex items-end gap-2">
      {/* Avatar placeholder — mirrors assistant bubble alignment */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
        AI
      </div>

      <div className="flex max-w-xs flex-col gap-1">
        <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
          </div>
        </div>
        <p className="px-1 text-xs text-gray-400">Your Coach is analyzing your habit data…</p>
      </div>
    </div>
  );
}
