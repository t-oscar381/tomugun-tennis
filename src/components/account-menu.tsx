import Link from "next/link";
import { signOutAction } from "@/app/actions";

/**
 * Who am I, and how do I get out.
 *
 * This app identifies people by "pick your name from a list", which makes it
 * unusually easy to end up logged in as someone else — a shared phone, a
 * borrowed tablet at the club, or just tapping the wrong row. Until now the
 * only way to tell was to hunt for the highlighted row on the ladder, and the
 * only escape was a link buried at the bottom of a profile page.
 *
 * Built on <details> rather than a client component: no JS, no hydration, and
 * it still closes on Escape. The cost is that it doesn't close on outside
 * click, which is a fair trade for a menu with three items.
 */
export function AccountMenu({
  name,
  emoji,
  playerId,
  wins,
  losses,
  groupName,
}: {
  name: string;
  emoji: string;
  playerId: string;
  wins: number;
  losses: number;
  groupName: string;
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] py-1 pl-1 pr-3 marker:hidden">
        <span
          aria-hidden
          className="flex size-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-base"
        >
          {emoji}
        </span>
        <span className="hidden text-sm font-semibold sm:block">{name}</span>
        <span aria-hidden className="text-xs text-[var(--color-muted)] transition-transform group-open:rotate-180">
          ▾
        </span>
        <span className="sr-only">Account menu for {name}</span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-lg">
        <div className="border-b border-[var(--color-line)] p-4">
          <p className="text-xs text-[var(--color-muted)]">Signed in as</p>
          <p className="mt-0.5 flex items-center gap-2 font-bold">
            <span aria-hidden>{emoji}</span>
            {name}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{groupName}</p>
          <p className="nums mt-2 text-sm font-semibold">
            {wins}–{losses} <span className="font-normal text-[var(--color-muted)]">won – lost</span>
          </p>
        </div>

        <Link
          href={`/player/${playerId}`}
          className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]"
        >
          My record &amp; name
        </Link>
        <Link href="/how" className="block px-4 py-3 text-sm hover:bg-[var(--color-surface-2)]">
          How it works
        </Link>

        <form action={signOutAction} className="border-t border-[var(--color-line)]">
          <button className="w-full px-4 py-3 text-left text-sm font-semibold text-[var(--color-loss)] hover:bg-[var(--color-surface-2)]">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
