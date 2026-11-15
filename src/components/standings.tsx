import Link from "next/link";
import type { MatchRow, PlayerRow } from "@/lib/db";
import { RankBadge } from "./rank";

/**
 * The record book: who has won what.
 *
 * Ordered by wins, then by fewest losses — the plainest ordering there is, and
 * one everybody in a small group can check in their head. Rank badges are
 * optional so the same table serves the real league (records only) and the
 * example league (which shows what ranked play looks like).
 */
export function byRecord(a: PlayerRow, b: PlayerRow): number {
  return b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
}

export function Standings({
  players,
  meId,
  showRanks = false,
}: {
  players: PlayerRow[];
  meId?: string;
  showRanks?: boolean;
}) {
  const rows = [...players].sort(byRecord);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="nums flex items-center gap-3 border-b border-[var(--color-line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-10 text-center">Won</span>
        <span className="w-10 text-center">Lost</span>
        <span className="w-12 text-right">Win %</span>
      </div>
      <ol className="divide-y divide-[var(--color-line)]">
        {rows.map((p, i) => {
          const isMe = p.id === meId;
          const pct = p.matches ? `${Math.round((p.wins / p.matches) * 100)}%` : "—";
          return (
            <li key={p.id} className={isMe ? "bg-[var(--color-clay-soft)]" : undefined}>
              <Link href={`/player/${p.id}`} className="flex items-center gap-3 px-3 py-3">
                <span className="nums w-6 shrink-0 text-center text-sm font-bold text-[var(--color-muted)]">
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)]"
                  >
                    {p.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {p.name}
                      {isMe && (
                        <span className="ml-1.5 rounded bg-[var(--color-clay)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          you
                        </span>
                      )}
                    </span>
                    {showRanks && p.matches >= 5 && <RankBadge rp={p.rp} size="sm" />}
                    {!showRanks && p.streak >= 3 && (
                      <span className="nums block text-xs text-[var(--color-win)]">
                        {p.streak} wins in a row
                      </span>
                    )}
                  </span>
                </span>
                <span className="nums w-10 text-center font-semibold">{p.wins}</span>
                <span className="nums w-10 text-center text-[var(--color-muted)]">{p.losses}</span>
                <span className="nums w-12 text-right text-sm">{pct}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "6-4" -> "4-6", "7-6(4)" -> "6-7(4)", "[10-8]" -> "[8-10]". */
export function flipSetToken(token: string): string {
  const mtb = /^\[(\d+)-(\d+)\]$/.exec(token);
  if (mtb) return `[${mtb[2]}-${mtb[1]}]`;
  const m = /^(\d+)-(\d+)(\(\d+\))?$/.exec(token);
  if (!m) return token;
  return `${m[2]}-${m[1]}${m[3] ?? ""}`;
}

/** Scoreline as the winner would read it. Stored from player_a's side. */
export function winnerScore(m: MatchRow): string {
  return m.winner_id === m.player_a
    ? m.scoreline
    : m.scoreline.split(" ").map(flipSetToken).join(" ");
}

export function ResultsList({ matches, players }: { matches: MatchRow[]; players: PlayerRow[] }) {
  const name = new Map(players.map((p) => [p.id, p.name]));
  if (matches.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">No confirmed matches yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {matches.map((m) => {
        const loser = m.winner_id === m.player_a ? m.player_b : m.player_a;
        return (
          <li
            key={m.id}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <p>
              <span className="font-semibold">{name.get(m.winner_id) ?? "?"}</span>
              <span className="text-[var(--color-muted)]"> beat </span>
              {name.get(loser) ?? "?"}
            </p>
            <p className="nums mt-0.5 text-xs text-[var(--color-muted)]">
              {winnerScore(m)} ·{" "}
              {new Date(m.played_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
