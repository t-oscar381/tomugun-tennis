import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatches, getPendingFor, getPlayers, type PlayerRow } from "@/lib/db";
import { RP, rankFromRp } from "@/lib/engine/ranks";
import { runRatingPeriods } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { RankBadge, RpDelta } from "@/components/rank";
import { confirmAction, disputeAction } from "./actions";

// Every view here changes the moment a match is confirmed, so nothing is
// prerendered. (No runtime = "edge" — it breaks page loading under OpenNext,
// the same way it did in tomugun-celebration.)
export const dynamic = "force-dynamic";

export default async function LadderPage({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/join");

  const { group, player } = session;
  const { logged } = await searchParams;

  // Fold any closed weeks into MMR before rendering, so the ladder is never
  // stale just because no cron has run. It's a no-op once caught up.
  //
  // This calls runRatingPeriods directly rather than the recalcAction server
  // action, because that action ends with revalidatePath("/") and Next throws
  // "Route / used revalidatePath during render" if a cache invalidation is
  // requested from a component. There is nothing to invalidate here anyway:
  // the page is force-dynamic and reads the updated rows further down in this
  // same render.
  await runRatingPeriods(group.id);

  const [players, pending, recent] = await Promise.all([
    getPlayers(group.id),
    getPendingFor(group.id, player.id),
    getMatches(group.id, { limit: 12, status: "confirmed" }),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));
  const ranked = players.filter((p) => p.matches >= RP.placementMatches);
  const placing = players.filter((p) => p.matches < RP.placementMatches);

  return (
    <div className="space-y-8">
      {logged && (
        <p className="rounded-lg border border-[var(--color-ace)]/30 bg-[var(--color-ace)]/10 px-3 py-2 text-sm text-[var(--color-ace)]">
          Match logged. It moves the ladder once {""}
          your opponent confirms it.
        </p>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Waiting on you
          </h2>
          {pending.map((m) => {
            const opponentId = m.player_a === player.id ? m.player_b : m.player_a;
            const opponent = byId.get(opponentId);
            const iWon = m.winner_id === player.id;
            // Stored scorelines always read from player_a's perspective.
            const asWritten = m.player_a === player.id ? m.scoreline : `(their ${m.scoreline})`;

            return (
              <div
                key={m.id}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-court-2)] p-4"
              >
                <p className="text-sm">
                  <span className="font-semibold">{opponent?.name ?? "Someone"}</span> logged a
                  match: <span className={iWon ? "text-[var(--color-ace)]" : "text-[#ff8080]"}>
                    {iWon ? "you won" : "you lost"}
                  </span>{" "}
                  <span className="nums text-[var(--color-muted)]">{asWritten}</span>
                </p>
                <div className="mt-3 flex gap-2">
                  <form action={confirmAction}>
                    <input type="hidden" name="matchId" value={m.id} />
                    <button className="rounded-lg bg-[var(--color-ace)] px-3 py-1.5 text-sm font-semibold text-[var(--color-court)]">
                      That&apos;s right
                    </button>
                  </form>
                  <form action={disputeAction}>
                    <input type="hidden" name="matchId" value={m.id} />
                    <button className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-muted)]">
                      Not right
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">{group.name}</h1>
          <Link href="/log" className="text-sm font-semibold text-[var(--color-ace)]">
            Log a match →
          </Link>
        </div>

        {ranked.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Nobody is ranked yet. Everyone plays {RP.placementMatches} placement matches first.
          </p>
        ) : (
          <ol className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-court-2)]">
            {ranked.map((p, i) => (
              <LadderRow key={p.id} rank={i + 1} player={p} isMe={p.id === player.id} />
            ))}
          </ol>
        )}

        {placing.length > 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-line)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              In placements
            </h3>
            <ul className="mt-2 space-y-1.5">
              {placing.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/player/${p.id}`} className="hover:underline">
                    {p.emoji} {p.name}
                  </Link>
                  <span className="nums text-[var(--color-muted)]">
                    {p.matches}/{RP.placementMatches} matches
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Recent results
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No confirmed matches yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((m) => {
              const a = byId.get(m.player_a);
              const b = byId.get(m.player_b);
              const aWon = m.winner_id === m.player_a;
              const winner = aWon ? a : b;
              const loser = aWon ? b : a;
              const winnerRp = aWon ? m.rp_delta_a : m.rp_delta_b;
              const loserRp = aWon ? m.rp_delta_b : m.rp_delta_a;
              const upset = aWon ? m.win_prob_a < 0.4 : m.win_prob_a > 0.6;

              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-[var(--color-court-2)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className="font-semibold">{winner?.name}</span>
                      <span className="text-[var(--color-muted)]"> def. </span>
                      {loser?.name}
                      {upset && (
                        <span className="ml-2 rounded bg-[var(--color-master)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-master)]">
                          Upset
                        </span>
                      )}
                    </p>
                    <p className="nums text-xs text-[var(--color-muted)]">
                      {aWon ? m.scoreline : `${m.scoreline} (from ${a?.name}'s side)`}
                    </p>
                  </div>
                  <div className="nums shrink-0 pl-3 text-right text-xs">
                    <RpDelta delta={winnerRp} />
                    <span className="text-[var(--color-muted)]"> / </span>
                    <RpDelta delta={loserRp} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function LadderRow({
  rank,
  player,
  isMe,
}: {
  rank: number;
  player: PlayerRow;
  isMe: boolean;
}) {
  const r = rankFromRp(player.rp);
  const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;

  return (
    <li className={isMe ? "bg-[var(--color-ace)]/[0.06]" : undefined}>
      <Link href={`/player/${player.id}`} className="flex items-center gap-3 px-3 py-3">
        <span className="nums w-6 shrink-0 text-center text-sm font-bold text-[var(--color-muted)]">
          {rank}
        </span>
        <span aria-hidden className="text-lg">
          {player.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {player.name}
            {isMe && <span className="ml-1.5 text-xs text-[var(--color-ace)]">you</span>}
          </span>
          <span className="nums block text-xs text-[var(--color-muted)]">
            {player.wins}-{player.losses} · {winRate}%
            {player.streak >= 3 && (
              <span className="ml-1.5 text-[var(--color-ace)]">🔥 {player.streak}</span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <RankBadge rp={player.rp} size="sm" />
          <span className="nums mt-1 block text-xs text-[var(--color-muted)]">
            {Math.round(player.rp)} RP
          </span>
        </span>
      </Link>
      <span className="sr-only">{r.label}</span>
    </li>
  );
}
