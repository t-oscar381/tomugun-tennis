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
export function InviteCard({
  inviteUrl,
  code,
  qr,
}: {
  inviteUrl: string;
  code: string;
  /** A server-rendered QR of the invite link. */
  qr?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const message = `Join our tennis group 🎾\n\nAdd your name and log who wins:\n${inviteUrl}`;

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
    <section className="card space-y-3 p-5">
      <div>
        <h2 className="text-xl">Invite the group</h2>
        <p className="text-sm text-muted">
          One link. They tap it, pick a name, and they&apos;re playing.
        </p>
      </div>

      {qr && (
        <a href="/invite" className="flex items-center gap-4 rounded-2xl bg-bg p-3">
          <span className="block w-24 shrink-0 overflow-hidden rounded-xl border border-line">{qr}</span>
          <span className="text-sm">
            <span className="block font-bold">Standing next to them?</span>
            <span className="text-muted">Let them scan this. Tap to show it full screen.</span>
          </span>
        </a>
      )}

      <p className="nums break-all rounded-lg bg-bg px-3 py-2 text-xs text-muted">
        {inviteUrl}
      </p>

      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener"
          className="flex-1 rounded-full bg-win px-3 py-2.5 text-center text-sm font-bold text-white"
        >
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-xs text-muted">
        Code: <span className="nums font-semibold text-ink">{code}</span> — anyone
        with this link can join, so keep it to the group.
      </p>
    </section>
  );
}
