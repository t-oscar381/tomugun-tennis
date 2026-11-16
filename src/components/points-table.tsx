import Link from "next/link";
import { winRate, type Row } from "@/lib/games";

interface Person {
  id: string;
  name: string;
  emoji: string;
}

/**
 * Points, played, win rate. Deliberately the plainest table there is: it is
 * what the group argues over, so it has to be readable at a glance.
 */
export function PointsTable({
  rows,
  people,
  meId,
  link = true,
}: {
  rows: Row[];
  people: Person[];
  meId?: string;
  link?: boolean;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="nums flex items-center gap-3 border-b border-[var(--color-line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-12 text-center">Points</span>
        <span className="w-12 text-center">Played</span>
        <span className="w-12 text-right">Win %</span>
      </div>
      <ol className="divide-y divide-[var(--color-line)]">
        {rows.map((r, i) => {
          const p = byId.get(r.id);
          const isMe = r.id === meId;
          const label = (
            <>
              <span className="nums w-6 shrink-0 text-center text-sm font-bold text-[var(--color-muted)]">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)]"
                >
                  {p?.emoji ?? "🎾"}
                </span>
                <span className="truncate font-semibold">
                  {p?.name ?? "?"}
                  {isMe && (
                    <span className="ml-1.5 rounded bg-[var(--color-clay)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      you
                    </span>
                  )}
                </span>
              </span>
              <span className="nums w-12 text-center text-lg font-bold">{r.points}</span>
              <span className="nums w-12 text-center text-[var(--color-muted)]">{r.played}</span>
              <span className="nums w-12 text-right text-sm">{winRate(r)}</span>
            </>
          );
          return (
            <li key={r.id} className={isMe ? "bg-[var(--color-clay-soft)]" : undefined}>
              {link && p ? (
                <Link href={`/player/${r.id}`} className="flex items-center gap-3 px-3 py-3">
                  {label}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-3">{label}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
