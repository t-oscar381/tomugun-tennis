"use client";

import { useState } from "react";

/**
 * Handing the league to ten other people.
 *
 * Previously the only way in was "here's a link, and separately here's a code",
 * which is two things to send and one thing to forget. This produces a single
 * link that carries the code, plus a WhatsApp button — because that is where
 * this group actually lives.
 *
 * The code is visible here on purpose: it belongs to anyone already in the
 * league, and someone will inevitably want to read it out loud courtside.
 */
export function InviteCard({ inviteUrl, code }: { inviteUrl: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const message = `Join our tennis ladder 🎾\n\nLog your matches, climb the rankings:\n${inviteUrl}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some in-app browsers; the link is on screen
      // and selectable, so this is a nicety rather than the only route.
      setCopied(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div>
        <h2 className="font-bold">Invite the group</h2>
        <p className="text-sm text-[var(--color-muted)]">
          One link. They tap it, pick a name, and they&apos;re playing.
        </p>
      </div>

      <p className="nums break-all rounded-lg bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
        {inviteUrl}
      </p>

      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener"
          className="flex-1 rounded-lg bg-[var(--color-win)] px-3 py-2.5 text-center text-sm font-bold text-white"
        >
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Code: <span className="nums font-semibold text-[var(--color-ink)]">{code}</span> — anyone
        with this link can join, so keep it to the group.
      </p>
    </section>
  );
}
