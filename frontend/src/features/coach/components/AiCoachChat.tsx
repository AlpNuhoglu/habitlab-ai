import { useEffect, useRef, useState } from 'react';

import { useChatHistory } from '../api/use-chat-history';
import { useClearHistory } from '../api/use-clear-history';
import { useSendMessage } from '../api/use-send-message';
import { ChatInput } from './ChatInput';
import { ChatMessageBubble } from './ChatMessageBubble';
import { TypingIndicator } from './TypingIndicator';

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-purple-500/40 bg-purple-900/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-7 w-7 text-purple-400"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.155L8.945 21.91c-.195.195-.44.29-.688.29-.248 0-.493-.095-.688-.29L4.92 18.538a.39.39 0 0 0-.298-.154 49.178 49.178 0 0 1-3.476-.384c-1.978-.292-3.348-2.024-3.348-3.97V6.74c0-1.946 1.37-3.678 3.348-3.97h.003Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-200">Your AI Coach is ready</p>
        <p className="mt-1 max-w-xs text-xs text-gray-500">
          Ask anything about your habits — streaks, best times, what to improve, or how to stay
          motivated. Your data is already loaded.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {[
          'Why am I struggling with consistency?',
          "What's my best habit right now?",
          'How can I improve my completion rate?',
        ].map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-purple-500/40 bg-purple-900/20 px-3 py-1.5 text-xs font-medium text-purple-300 transition-all hover:border-purple-400 hover:bg-purple-900/30 hover:shadow-[0_0_8px_rgba(168,85,247,0.2)]"
            onClick={() => {
              // Bubble up via a custom event; AiCoachChat listens and fills the input
              window.dispatchEvent(new CustomEvent('coach:suggestion', { detail: prompt }));
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AiCoachChat(): React.ReactElement {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const historyQuery = useChatHistory();
  const sendMessage = useSendMessage();
  const clearHistory = useClearHistory();

  const messages = historyQuery.data?.messages ?? [];
  const isPending = sendMessage.isPending;

  function handleClear() {
    if (clearHistory.isPending || messages.length === 0) return;
    const confirmed = window.confirm(
      'Clear the entire conversation? This permanently deletes all messages and starts a fresh chat.',
    );
    if (confirmed) clearHistory.mutate();
  }

  // Auto-scroll when messages change or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isPending]);

  // Listen for suggestion chip clicks from the empty state
  useEffect(() => {
    function handleSuggestion(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      setDraft(text);
    }
    window.addEventListener('coach:suggestion', handleSuggestion);
    return () => window.removeEventListener('coach:suggestion', handleSuggestion);
  }, []);

  function handleSubmit() {
    const text = draft.trim();
    if (!text || isPending) return;
    setDraft('');
    sendMessage.mutate({ message: text });
  }

  const showEmpty = messages.length === 0 && !historyQuery.isPending;

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-xl border border-purple-500/20 bg-gray-950/60 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.1)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-800 bg-black/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-900/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-cyan-400"
            aria-hidden="true"
          >
            <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-100 tracking-wide">HabitLab Coach</p>
          <p className="text-xs text-gray-600">Powered by behavioral science · your data is loaded</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={messages.length === 0 || clearHistory.isPending}
            title="Clear conversation history"
            className="flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1 text-xs font-medium text-gray-400 transition-all hover:border-red-500/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-700 disabled:hover:text-gray-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                clipRule="evenodd"
              />
            </svg>
            {clearHistory.isPending ? 'Clearing…' : 'Clear'}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" aria-hidden="true" />
            <span className="text-xs text-gray-600">Ready</span>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {historyQuery.isPending && (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          </div>
        )}

        {historyQuery.isError && (
          <div className="rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            Could not load chat history. Please refresh.
          </div>
        )}

        {showEmpty && <EmptyState />}

        {messages.length > 0 && (
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}

            {isPending && <TypingIndicator />}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        disabled={isPending}
      />
    </div>
  );
}
