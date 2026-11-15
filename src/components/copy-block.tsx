"use client";

import { useState } from "react";

/** A block of text with a copy button. For the one-time SQL paste. */
export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Blocked in some in-app browsers. The text is on screen and selectable.
    }
  };

  return (
    <div className="space-y-2">
      <pre className="max-h-64 overflow-auto rounded-lg bg-[var(--color-bg)] p-3 text-xs leading-relaxed">
        <code>{text}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-[var(--color-clay)] px-4 py-2 text-sm font-bold text-white"
      >
        {copied ? "Copied" : "Copy the SQL"}
      </button>
    </div>
  );
}
