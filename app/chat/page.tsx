import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { chats } from "@/db/schema";
import UserMenu from "@/components/UserMenu";
import ChatApp from "@/components/ChatApp";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const userChats = await db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(eq(chats.userId, session.user.id))
    .orderBy(desc(chats.updatedAt));

  // Drizzle returns Date objects for timestamp columns; the client components
  // work with ISO strings so they're safe to pass from a server component.
  const serializedChats = userChats.map((c) => ({
    ...c,
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-petrol px-6 py-4 text-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <a href="/chat" className="font-display text-lg">
            CleanTech Desk
          </a>
          <UserMenu user={session.user} />
        </div>
      </header>
      <ChatApp initialChats={serializedChats} />
    </div>
  );
}
