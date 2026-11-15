import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatches, getPlayer, getPlayers } from "@/lib/db";
import { getSession } from "@/lib/session";
import { RenameForm } from "@/components/rename-form";
import { flipSetToken } from "@/components/standings";
import { signOutAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  return player ? { title: player.name } : { title: "Player" };
}

/**
 * A player's record: totals, head-to-heads, and every match.
 *
 * Deliberately no rank, rank points or chart — the group asked for records
 * only. The head-to-head table is the part people actually look at.
 */
export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ renamed?: string }>;
}) {
  const { id } = await params;
  const { renamed } = await searchParams;

  const player = await getPlayer(id);
  if (!player) notFound();

  const session = await getSession();
  const isMe = session?.player.id === player.id;

  const [roster, matches] = await Promise.all([
    getPlayers(player.group_id),
    getMatches(player.group_id, { playerId: player.id, status: "confirmed", limit: 200 }),
  ]);

  const byId = new Map(roster.map((p) => [p.id, p]));
  const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;

  const h2h = new Map<string, { played: number; won: number }>();
  for (const m of matches) {
    const oppId = m.player_a === player.id ? m.player_b : m.player_a;
    const rec = h2h.get(oppId) ?? { played: 0, won: 0 };
    rec.played++;
    if (m.winner_id === player.id) rec.won++;
    h2h.set(oppId, rec);
  }
  const rivalries = [...h2h.entries()]
    .map(([oppId, rec]) => ({ opponent: byId.get(oppId), ...rec }))
    .filter((r) => r.opponent)
    .sort((a, b) => b.played - a.played);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {renamed && (
        <p className="rounded-xl border border-[var(--color-win)]/40 bg-[var(--color-win)]/10 px-4 py-3 text-sm">
          Name saved.
        </p>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h1 className="flex min-w-0 items-center gap-3 text-2xl font-bold tracking-tight">
          <span aria-hidden>{player.emoji}</span>
          <span className="truncate">{player.name}</span>
        </h1>
        <dl className="nums flex gap-6 text-center">
          <Stat label="Won" value={player.wins} />
          <Stat label="Lost" value={player.losses} />
          <Stat label="Win %" value={player.matches ? `${winRate}%` : "—"} />
        </dl>
      </section>

      {isMe && (
        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <RenameForm current={player.name} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Head to head
        </h2>
        {rivalries.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No matches yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            {rivalries.map((r) => {
              const lost = r.played - r.won;
              return (
                <li key={r.opponent!.id} className="flex items-center justify-between px-3 py-2.5">
                  <Link href={`/player/${r.opponent!.id}`} className="truncate text-sm hover:underline">
                    {r.opponent!.emoji} {r.opponent!.name}
                  </Link>
                  <span
                    className={`nums text-sm font-semibold ${
                      r.won > lost
                        ? "text-[var(--color-win)]"
                        : lost > r.won
                          ? "text-[var(--color-loss)]"
                          : ""
                    }`}
                  >
                    {r.won}–{lost}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Match history
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No confirmed matches yet.</p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => {
              const isA = m.player_a === player.id;
              const oppId = isA ? m.player_b : m.player_a;
              const won = m.winner_id === player.id;
              const score = isA ? m.scoreline : m.scoreline.split(" ").map(flipSetToken).join(" ");
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <p className="min-w-0 truncate">
                    <span
                      className={`font-bold ${won ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"}`}
                    >
                      {won ? "Won" : "Lost"}
                    </span>{" "}
                    <span className="text-[var(--color-muted)]">v</span> {byId.get(oppId)?.name ?? "—"}
                  </p>
                  <p className="nums shrink-0 pl-3 text-xs text-[var(--color-muted)]">
                    {score} ·{" "}
                    {new Date(m.played_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isMe && (
        <form action={signOutAction}>
          <button className="text-xs text-[var(--color-muted)] underline">Not you? Sign out</button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dd className="text-2xl font-bold">{value}</dd>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
    </div>
  );
}
