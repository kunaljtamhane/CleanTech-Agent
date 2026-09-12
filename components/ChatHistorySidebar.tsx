"use client";

import type { ChatSummary } from "@/lib/types";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ChatHistorySidebar({
  chats,
  activeChatId,
  onSelect,
  onNewChat,
  disabled,
}: {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  disabled: boolean;
}) {
  return (
    <nav className="flex h-full flex-col">
      <button
        onClick={onNewChat}
        disabled={disabled}
        className="rounded-full border border-petrol px-4 py-2 text-sm font-medium text-petrol transition-colors hover:bg-petrol hover:text-paper disabled:opacity-40"
      >
        + New chat
      </button>

      <div className="mt-6 flex-1 overflow-y-auto">
        <p className="text-xs text-muted">Previous chats</p>
        {chats.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Your conversations will appear here.</p>
        ) : (
          <ul className="mt-2 space-y-0.5">
            {chats.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={`block w-full truncate rounded-sm px-2 py-2 text-left text-sm transition-colors ${
                    c.id === activeChatId
                      ? "bg-petrol/10 text-ink"
                      : "text-muted hover:bg-petrol/5 hover:text-ink"
                  }`}
                  title={c.title}
                >
                  {c.title}
                  <span className="block text-xs text-muted">{formatRelative(c.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
