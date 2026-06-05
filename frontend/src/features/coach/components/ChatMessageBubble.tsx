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
            className={`rounded-2xl rounded-br-sm px-4 py-2.5 text-sm text-white shadow-sm ${
              isOptimistic ? 'bg-indigo-400' : 'bg-indigo-600'
            }`}
          >
            {message.content}
          </div>
          {!isOptimistic && (
            <span className="px-1 text-xs text-gray-400">{formatTime(message.createdAt)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
        AI
      </div>
      <div className="flex max-w-sm flex-col gap-1 lg:max-w-lg">
        <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm ring-1 ring-gray-100">
          {message.content}
        </div>
        <span className="px-1 text-xs text-gray-400">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
