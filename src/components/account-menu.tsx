import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { Avatar } from "./avatar";

/**
 * Who am I, and how do I get out.
 *
 * This app identifies people by "pick your name from a list", which makes it
 * unusually easy to end up logged in as someone else — a shared phone, a
 * borrowed tablet at the club, or just tapping the wrong row. The header
 * always shows whose account this is, and the way out is one tap away.
 *
 * Built on <details> rather than a client component: no JS, no hydration, and
 * it still closes on Escape. The cost is that it doesn't close on outside
 * click, which is a fair trade for a menu with three items.
 */
export function AccountMenu({
  name,
  playerId,
  groupName,
}: {
  name: string;
  playerId: string;
  groupName: string;
}) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 marker:hidden">
        <Avatar id={playerId} name={name} size={32} />
        <span className="hidden max-w-[9rem] truncate text-sm font-semibold sm:block">{name}</span>
        <span aria-hidden className="text-xs text-muted transition-transform group-open:rotate-180">
          ▾
        </span>
        <span className="sr-only">Account menu for {name}</span>
      </summary>

      <div className="card absolute right-0 z-20 mt-2 w-64 overflow-hidden !shadow-xl">
        <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 p-4">
          <Avatar id={playerId} name={name} size={44} />
          <div className="min-w-0">
            <p className="eyebrow text-muted">Signed in as</p>
            <p className="truncate font-bold">{name}</p>
            <p className="truncate text-xs text-muted">{groupName}</p>
          </div>
        </div>

        <Link href={`/player/${playerId}`} className="block px-4 py-3 text-sm hover:bg-surface-2">
          My points &amp; name
        </Link>
        <Link href="/invite" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Invite someone (QR code)
        </Link>
        <Link href="/how" className="block px-4 py-3 text-sm hover:bg-surface-2">
          How it works
        </Link>

        <form action={signOutAction} className="border-t border-line">
          <button className="w-full px-4 py-3 text-left text-sm font-semibold text-loss hover:bg-surface-2">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
