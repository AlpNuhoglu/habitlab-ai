import type { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessageBubble({ message }: Props): React.ReactElement {
  const isUser = message.role === 'user';
  const isOptimistic = message.id.startsWith('optimistic-');

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-sm flex-col items-end gap-1 lg:max-w-lg">
          <div
            className={`rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-gray-100 border ${
              isOptimistic
                ? 'border-purple-500/30 bg-purple-900/30'
                : 'border-purple-500/40 bg-purple-900/40'
            }`}
          >
            {message.content}
          </div>
          {!isOptimistic && (
            <span className="px-1 text-xs text-gray-600 font-mono">{formatTime(message.createdAt)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-900/20 text-xs font-semibold text-cyan-400">
        AI
      </div>
      <div className="flex max-w-sm flex-col gap-1 lg:max-w-lg">
        <div className="rounded-2xl rounded-bl-sm border border-gray-700 bg-gray-900/60 px-4 py-2.5 text-sm text-gray-200">
          {message.content}
        </div>
        <span className="px-1 text-xs text-gray-600 font-mono">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
