import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { chats, messages } from "@/db/schema";

const API_URL = process.env.API_URL; // server-only, not exposed to the browser
const BACKEND_API_KEY = process.env.BACKEND_API_KEY; // must match the backend's setting

async function getOwnedChat(chatId: string, userId: string) {
  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  return chat;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { chatId } = await params;

  const chat = await getOwnedChat(chatId, session.user.id);
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt));

  return NextResponse.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!API_URL) {
    return NextResponse.json({ error: "API_URL is not configured on the server" }, { status: 500 });
  }
  const { chatId } = await params;

  const chat = await getOwnedChat(chatId, session.user.id);
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  await db.insert(messages).values({ chatId, role: "user", content: content.trim() });

  let ragResult: { answer: string; citations: unknown[]; blocked: boolean };
  try {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(BACKEND_API_KEY ? { "X-API-Key": BACKEND_API_KEY } : {}),
      },
      body: JSON.stringify({ message: content.trim() }),
    });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    ragResult = await res.json();
  } catch {
    return NextResponse.json(
      { error: "The research backend is unavailable right now. Please try again shortly." },
      { status: 502 }
    );
  }

  const [assistantMessage] = await db
    .insert(messages)
    .values({
      chatId,
      role: "assistant",
      content: ragResult.answer,
      blocked: ragResult.blocked,
      citations: ragResult.blocked ? [] : (ragResult.citations as never[]),
    })
    .returning();

  // Title the chat from the first user message, and bump updatedAt for sidebar ordering.
  const isFirstExchange = chat.title === "New chat";
  await db
    .update(chats)
    .set({
      updatedAt: new Date(),
      ...(isFirstExchange ? { title: content.trim().slice(0, 60) } : {}),
    })
    .where(eq(chats.id, chatId));

  return NextResponse.json(assistantMessage);
}
