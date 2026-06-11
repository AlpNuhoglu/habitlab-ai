export function TypingIndicator(): React.ReactElement {
  return (
    <div className="flex items-end gap-2">
      {/* Avatar placeholder — mirrors assistant bubble alignment */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-900/20 text-xs font-semibold text-cyan-400">
        AI
      </div>

      <div className="flex max-w-xs flex-col gap-1">
        <div className="rounded-2xl rounded-bl-sm border border-gray-700 bg-gray-900/60 px-4 py-3">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:300ms]" />
          </div>
        </div>
        <p className="px-1 text-xs text-gray-600">Your Coach is analyzing your habit data…</p>
      </div>
    </div>
  );
}
