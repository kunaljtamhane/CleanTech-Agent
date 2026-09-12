import type { Message } from "@/lib/types";

const CITATION_RE = /\[(\d+)\]/g;

function AnswerText({ text, citationCount }: { text: string; citationCount: number }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const n = Number(match[1]);
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const valid = n >= 1 && n <= citationCount;
    parts.push(
      <sup
        key={`cite-${key++}`}
        className={
          valid
            ? "mx-0.5 rounded-sm bg-amber-dim px-1 py-0.5 text-[0.7em] font-medium text-petrol"
            : "mx-0.5 text-[0.7em] text-muted"
        }
      >
        {n}
      </sup>
    );
    lastIndex = CITATION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <p className="whitespace-pre-wrap leading-relaxed">{parts}</p>;
}

export default function ChatMessageView({
  message,
  pending,
}: {
  message: Message;
  pending?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className="animate-rise-in">
      <div className="flex items-baseline gap-2 text-xs text-muted">
        <span className="font-medium text-ink">{isUser ? "You" : "CleanTech Desk"}</span>
      </div>

      <div className="mt-1.5 text-[15px] text-ink">
        {pending ? (
          <div className="flex items-center gap-1 py-1 text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-petrol" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-petrol [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-petrol [animation-delay:240ms]" />
          </div>
        ) : message.blocked ? (
          <div className="rounded-sm border-l-2 border-clay bg-clay-dim/40 py-2 pl-3 text-ink">
            {message.content}
          </div>
        ) : (
          <AnswerText text={message.content} citationCount={message.citations?.length ?? 0} />
        )}
      </div>
    </div>
  );
}
