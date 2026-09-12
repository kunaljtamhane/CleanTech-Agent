"use client";

import { useEffect, useRef, useState } from "react";
import ChatMessageView from "./ChatMessage";
import ChatInput from "./ChatInput";
import SourcesRail from "./SourcesRail";
import ChatHistorySidebar from "./ChatHistorySidebar";
import { createChat, getMessages, listChats, sendMessage } from "@/lib/api";
import type { ChatSummary, Message } from "@/lib/types";

const EXAMPLE_PROMPTS = [
  "What are the four focus areas of the EU's Green Deal Industrial Plan?",
  "How does agrovoltaics combine farming with solar power?",
  "What's driving the recent growth in green hydrogen projects?",
];

export default function ChatApp({ initialChats }: { initialChats: ChatSummary[] }) {
  const [chats, setChats] = useState<ChatSummary[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(initialChats[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingReply, setPendingReply] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeChatId) return;
    setLoadingChat(true);
    getMessages(activeChatId)
      .then(setMessages)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingChat(false));
  }, [activeChatId]);

  const latestCitations =
    [...messages].reverse().find((m) => m.role === "assistant" && !m.blocked)?.citations ?? [];

  const refreshChatList = async () => {
    try {
      setChats(await listChats());
    } catch {
      // Sidebar staying stale for a beat is fine; not worth surfacing an error for.
    }
  };

  const handleNewChat = async () => {
    setError(null);
    const chat = await createChat();
    setChats((prev) => [{ ...chat }, ...prev]);
    setActiveChatId(chat.id);
    setMessages([]);
  };

  const handleSend = async (text: string) => {
    setError(null);
    let chatId = activeChatId;

    if (!chatId) {
      const chat = await createChat();
      setChats((prev) => [chat, ...prev]);
      chatId = chat.id;
      setActiveChatId(chatId);
    }

    const optimisticUser: Message = {
      id: `pending-user-${Date.now()}`,
      chatId,
      role: "user",
      content: text,
      blocked: false,
      citations: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setPendingReply(true);

    try {
      const assistantMessage = await sendMessage(chatId, text);
      setMessages((prev) => [...prev, assistantMessage]);
      await refreshChatList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setPendingReply(false);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-6">
      <div className="hidden w-56 shrink-0 lg:block">
        <ChatHistorySidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelect={setActiveChatId}
          onNewChat={handleNewChat}
          disabled={pendingReply}
        />
      </div>

      <section className="flex flex-1 flex-col">
        {messages.length === 0 && !loadingChat ? (
          <div className="flex flex-1 flex-col justify-center">
            <p className="font-display text-2xl leading-snug text-ink">
              Ask a question about clean technology and get an answer traced
              back to the source articles behind it.
            </p>
            <ul className="mt-6 space-y-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <li key={p}>
                  <button
                    onClick={() => handleSend(p)}
                    className="text-left text-sm text-petrol underline decoration-paper-line decoration-2 underline-offset-4 hover:decoration-amber"
                  >
                    {p}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            {messages.map((m) => (
              <div key={m.id}>
                <ChatMessageView message={m} />
                {m.role === "assistant" && !m.blocked && (m.citations?.length ?? 0) > 0 && (
                  <details className="mt-2 lg:hidden">
                    <summary className="cursor-pointer text-xs text-petrol">
                      Sources ({m.citations!.length})
                    </summary>
                    <div className="mt-2">
                      <SourcesRail citations={m.citations!} />
                    </div>
                  </details>
                )}
              </div>
            ))}
            {pendingReply && (
              <ChatMessageView
                message={{
                  id: "pending",
                  chatId: activeChatId ?? "",
                  role: "assistant",
                  content: "",
                  blocked: false,
                  citations: null,
                  createdAt: new Date().toISOString(),
                }}
                pending
              />
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {error && (
          <p className="mb-2 rounded-sm border-l-2 border-clay bg-clay-dim/40 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <ChatInput onSubmit={handleSend} disabled={pendingReply} />
      </section>

      <div className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-8">
          <SourcesRail citations={latestCitations} />
        </div>
      </div>
    </main>
  );
}
