import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatches, getPlayer, getPlayers, getRatingHistory } from "@/lib/db";
import { RP, rankFromRp } from "@/lib/engine/ranks";
import { getSession } from "@/lib/session";
import { RankBadge, RankProgress, RpDelta, StakeNote } from "@/components/rank";
import { leaveAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const player = await getPlayer(id);
  if (!player) notFound();

  const session = await getSession();
  const isMe = session?.player.id === player.id;

  const [roster, matches, history] = await Promise.all([
    getPlayers(player.group_id),
    getMatches(player.group_id, { playerId: player.id, status: "confirmed", limit: 40 }),
    getRatingHistory(player.id),
  ]);

  const byId = new Map(roster.map((p) => [p.id, p]));
  const inPlacements = player.matches < RP.placementMatches;
  const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;

  // Rivalries: the head-to-head record is what actually drives rematches, so
  // it gets more room than the aggregate stats do.
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

  const peak = rankFromRp(player.peak_rp);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span aria-hidden>{player.emoji}</span>
              <span className="truncate">{player.name}</span>
            </h1>
            <p className="nums mt-1 text-sm text-[var(--color-muted)]">
              {player.wins}-{player.losses} · {winRate}% wins
              {player.streak >= 3 && (
                <span className="ml-2 text-[var(--color-win)]">🔥 {player.streak} in a row</span>
              )}
              {player.streak <= -3 && (
                <span className="ml-2 text-[var(--color-loss)]">{Math.abs(player.streak)} straight losses</span>
              )}
            </p>
          </div>
          {!inPlacements && <RankBadge rp={player.rp} size="lg" />}
        </div>

        {inPlacements ? (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] p-4">
            <p className="text-sm">
              {player.matches} of {RP.placementMatches} placement matches played.
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Rank appears once placements are done — the starting RP is set from how those
              matches actually went.
            </p>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
            <RankProgress rp={player.rp} />
            <div className="flex items-center justify-between">
              <StakeNote rp={player.rp} />
              {player.peak_rp > player.rp && (
                <p className="text-xs text-[var(--color-muted)]">Peak: {peak.label}</p>
              )}
            </div>
          </div>
        )}
      </section>

      {rivalries.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Rivalries
          </h2>
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            {rivalries.map((r) => {
              const lost = r.played - r.won;
              const leading = r.won > lost;
              return (
                <li key={r.opponent!.id} className="flex items-center justify-between px-3 py-2.5">
                  <Link href={`/player/${r.opponent!.id}`} className="truncate text-sm hover:underline">
                    {r.opponent!.emoji} {r.opponent!.name}
                  </Link>
                  <span
                    className={`nums text-sm font-semibold ${
                      leading ? "text-[var(--color-win)]" : lost > r.won ? "text-[var(--color-loss)]" : ""
                    }`}
                  >
                    {r.won}-{lost}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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
              const delta = isA ? m.rp_delta_a : m.rp_delta_b;
              // Stored from player_a's side; flip the string for player B.
              const score = isA
                ? m.scoreline
                : m.scoreline
                    .split(" ")
                    .map(flipSetToken)
                    .join(" ");

              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className={won ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"}>
                        {won ? "W" : "L"}
                      </span>{" "}
                      <span className="text-[var(--color-muted)]">vs</span>{" "}
                      {byId.get(oppId)?.name ?? "—"}
                    </p>
                    <p className="nums text-xs text-[var(--color-muted)]">{score}</p>
                  </div>
                  <div className="shrink-0 pl-3">
                    {m.placement ? (
                      <span className="text-xs text-[var(--color-muted)]">placement</span>
                    ) : (
                      <RpDelta delta={delta} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <p className="nums text-xs text-[var(--color-muted)]">
          Rated over {history.length} week{history.length === 1 ? "" : "s"}.
        </p>
      )}

      {isMe && (
        <form action={leaveAction}>
          <button className="text-xs text-[var(--color-muted)] underline">Not you? Switch player</button>
        </form>
      )}
    </div>
  );
}

/** "6-4" -> "4-6", "7-6(4)" -> "6-7(4)", "[10-8]" -> "[8-10]". */
function flipSetToken(token: string): string {
  const mtb = /^\[(\d+)-(\d+)\]$/.exec(token);
  if (mtb) return `[${mtb[2]}-${mtb[1]}]`;
  const m = /^(\d+)-(\d+)(\(\d+\))?$/.exec(token);
  if (!m) return token;
  return `${m[2]}-${m[1]}${m[3] ?? ""}`;
}
