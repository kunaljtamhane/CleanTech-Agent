import type { ChatSummary, Message } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const listChats = () =>
  fetch("/api/chats").then((r) => json<ChatSummary[]>(r));

export const createChat = () =>
  fetch("/api/chats", { method: "POST" }).then((r) => json<ChatSummary>(r));

export const getMessages = (chatId: string) =>
  fetch(`/api/chats/${chatId}/messages`).then((r) => json<Message[]>(r));

export const sendMessage = (chatId: string, content: string) =>
  fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).then((r) => json<Message>(r));
