import type { Citation } from "@/lib/types";

function Clipping({ index, citation }: { index: number; citation: Citation }) {
  const hasUrl = citation.url && citation.url !== "N/A";
  const content = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-sm text-amber tabular-nums">
          {String(index).padStart(2, "0")}
        </span>
        <span className="font-display text-[15px] leading-snug text-ink group-hover:text-petrol">
          {citation.title}
        </span>
      </div>
      <div className="mt-1 pl-7 text-xs text-muted">
        {citation.domain}
        {citation.date && citation.date !== "n.d." ? ` — ${citation.date}` : ""}
      </div>
    </>
  );

  return (
    <li className="border-l-2 border-paper-line pl-3 py-2.5 transition-colors hover:border-amber">
      {hasUrl ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          {content}
        </a>
      ) : (
        <div>{content}</div>
      )}
    </li>
  );
}

export default function SourcesRail({ citations }: { citations: Citation[] }) {
  return (
    <aside className="h-full">
      <h2 className="font-display text-lg text-ink">Sources</h2>
      <p className="mt-1 text-xs text-muted">
        Cited in the current answer, pulled from the cleantech article archive.
      </p>
      <div className="mt-4 border-t border-paper-line">
        {citations.length === 0 ? (
          <p className="py-6 text-sm text-muted">
            Ask a question — the articles it draws from will be filed here.
          </p>
        ) : (
          <ul className="divide-y divide-paper-line">
            {citations.map((c, i) => (
              <Clipping key={`${c.url}-${i}`} index={i + 1} citation={c} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
