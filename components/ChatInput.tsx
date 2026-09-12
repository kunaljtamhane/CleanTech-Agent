"use client";

import { useState, type KeyboardEvent } from "react";

export default function ChatInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (value: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-3 border-t border-paper-line bg-paper pt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask about solar, wind, EVs, climate policy…"
        className="min-h-11 flex-1 resize-none bg-transparent py-2 text-[15px] text-ink placeholder:text-muted focus:outline-none disabled:opacity-50"
      />
      <button
        onClick={submit}
        disabled={disabled || !value.trim()}
        aria-label="Send question"
        className="mb-1 rounded-full bg-petrol px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-petrol-light disabled:cursor-not-allowed disabled:opacity-40"
      >
        Ask
      </button>
    </div>
  );
}
