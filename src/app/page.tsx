import Link from "next/link";
import { getGroupBySlug, getMatches, getPendingFor, getPlayers, type PlayerRow } from "@/lib/db";
import { RP, rankFromRp } from "@/lib/engine/ranks";
import { GROUP_SLUG } from "@/lib/league";
import { runRatingPeriods } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { RankBadge, RpDelta } from "@/components/rank";
import {
  FlowDiagram,
  Hero,
  JoinCta,
  PhotoStrip,
  RankExplainer,
  Steps,
} from "@/components/how-it-works";
import { confirmAction, disputeAction } from "./actions";

// Every view here changes the moment a match is confirmed, so nothing is
// prerendered. (No runtime = "edge" — it breaks page loading under OpenNext,
// the same way it did in tomugun-celebration.)
export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ logged?: string }>;
}) {
  const session = await getSession();

  // Not signed in? Explain the thing before asking for anything. This used to
  // redirect straight to /join, which showed a stranger a code box and no clue
  // what the app was.
  if (!session) return <Welcome />;

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
  const myPlacementsLeft = RP.placementMatches - player.matches;
  const myPosition = ranked.findIndex((p) => p.id === player.id) + 1;

  return (
    <div className="space-y-6">
      {logged && (
        <p className="rounded-xl border border-[var(--color-clay)]/40 bg-[var(--color-clay-soft)] px-4 py-3 text-sm">
          <strong className="font-semibold">Logged.</strong> Your opponent has to confirm it before
          it counts — nudge them if they&apos;re slow.
        </p>
      )}

      {/* Your own standing, first thing, so the page answers "how am I doing?"
          before it answers anything else. */}
      <MyStanding
        player={player}
        position={myPosition}
        placementsLeft={myPlacementsLeft}
        groupName={group.name}
      />

      {/* Two columns from lg up: the ladder earns the width, everything
          time-sensitive sits beside it instead of below the fold. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight">Ladder</h2>
              <span className="text-sm text-[var(--color-muted)]">{players.length} players</span>
            </div>

            {ranked.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                Nobody has a rank yet. Everyone plays {RP.placementMatches} matches first, then the
                ladder appears.
              </p>
            ) : (
              <ol className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                {ranked.map((p, i) => (
                  <LadderRow key={p.id} rank={i + 1} player={p} isMe={p.id === player.id} />
                ))}
              </ol>
            )}

            {placing.length > 0 && (
              <div className="rounded-xl border border-dashed border-[var(--color-line)] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Still in placements
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
        </div>

        <aside className="space-y-6">
          {pending.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="font-bold">Waiting on you</h2>
                <p className="text-sm text-[var(--color-muted)]">
                  Check the score is right before it counts.
                </p>
              </div>
              {pending.map((m) => {
                const opponentId = m.player_a === player.id ? m.player_b : m.player_a;
                const opponent = byId.get(opponentId);
                const iWon = m.winner_id === player.id;
                const asWritten =
                  m.player_a === player.id
                    ? m.scoreline
                    : m.scoreline.split(" ").map(flipSetToken).join(" ");

                return (
                  <div
                    key={m.id}
                    className="rounded-xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-4"
                  >
                    <p className="text-sm">
                      <span className="font-semibold">{opponent?.name ?? "Someone"}</span> says{" "}
                      <span
                        className={`font-semibold ${
                          iWon ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"
                        }`}
                      >
                        {iWon ? "you won" : "you lost"}
                      </span>
                    </p>
                    <p className="nums mt-1 text-lg font-bold">{asWritten}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={confirmAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <button className="rounded-lg bg-[var(--color-clay)] px-4 py-2 text-sm font-bold text-white">
                          Yes, that&apos;s right
                        </button>
                      </form>
                      <form action={disputeAction}>
                        <input type="hidden" name="matchId" value={m.id} />
                        <button className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-muted)]">
                          That&apos;s wrong
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          <Link
            href="/log"
            className="flex items-center justify-between rounded-xl bg-[var(--color-clay)] px-5 py-4 font-bold text-white"
          >
            <span>Log a match</span>
            <span aria-hidden>→</span>
          </Link>

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
                  const upset = aWon ? m.win_prob_a < 0.4 : m.win_prob_a > 0.6;
                  const score = aWon
                    ? m.scoreline
                    : m.scoreline.split(" ").map(flipSetToken).join(" ");

                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0">
                          <span className="font-semibold">{winner?.name}</span>
                          <span className="text-[var(--color-muted)]"> beat </span>
                          {loser?.name}
                        </p>
                        <RpDelta delta={winnerRp} />
                      </div>
                      <p className="nums mt-0.5 text-xs text-[var(--color-muted)]">
                        {score}
                        {upset && (
                          <span className="ml-2 rounded bg-[var(--color-master)]/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-master)]">
                            Upset
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/** The "you" card: rank, record, and what's at stake, above everything else. */
function MyStanding({
  player,
  position,
  placementsLeft,
  groupName,
}: {
  player: PlayerRow;
  position: number;
  placementsLeft: number;
  groupName: string;
}) {
  const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <p className="text-xs text-[var(--color-muted)]">{groupName}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-2xl"
          >
            {player.emoji}
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{player.name}</h1>
            <p className="nums text-sm text-[var(--color-muted)]">
              {player.wins}-{player.losses}
              {player.matches > 0 && ` · ${winRate}% wins`}
              {player.streak >= 3 && (
                <span className="ml-2 font-semibold text-[var(--color-win)]">
                  🔥 {player.streak} in a row
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="text-right">
          {placementsLeft > 0 ? (
            <>
              <p className="nums text-2xl font-bold">{placementsLeft}</p>
              <p className="text-xs text-[var(--color-muted)]">
                more {placementsLeft === 1 ? "match" : "matches"} to get ranked
              </p>
            </>
          ) : (
            <>
              <RankBadge rp={player.rp} size="lg" />
              <p className="nums mt-1 text-xs text-[var(--color-muted)]">
                {Math.round(player.rp)} RP{position > 0 && ` · #${position} on the ladder`}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** The signed-out home page: what this is, how to use it, then the door. */
async function Welcome() {
  const group = await getGroupBySlug(GROUP_SLUG);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <Hero groupName={group?.name} />
        <div className="mx-auto max-w-md space-y-2">
          <JoinCta label={group ? `Join ${group.name}` : "Join the league"} />
          <p className="text-center text-xs text-[var(--color-muted)]">
            You&apos;ll need the group code from whoever invited you.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">How it works</h2>
        <FlowDiagram />
        <Steps />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">The ranks</h2>
        <RankExplainer />
      </section>

      <PhotoStrip />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">Nothing counts until both agree</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Whoever logs the match, the other one has to confirm the score. No arguing with the
            leaderboard later.
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">Beating the same person pays less</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Each rematch with the same opponent is worth less than the last. Go find a tougher
            match.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-md">
        <JoinCta label="Ready — let me in" />
      </div>
    </div>
  );
}

function LadderRow({ rank, player, isMe }: { rank: number; player: PlayerRow; isMe: boolean }) {
  const r = rankFromRp(player.rp);
  const winRate = player.matches ? Math.round((player.wins / player.matches) * 100) : 0;

  return (
    <li className={isMe ? "bg-[var(--color-clay-soft)]" : undefined}>
      <Link href={`/player/${player.id}`} className="flex items-center gap-3 px-3 py-3">
        <span className="nums w-6 shrink-0 text-center text-sm font-bold text-[var(--color-muted)]">
          {rank}
        </span>
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-lg"
        >
          {player.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {player.name}
            {isMe && (
              <span className="ml-1.5 rounded bg-[var(--color-clay)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                you
              </span>
            )}
          </span>
          <span className="nums block text-xs text-[var(--color-muted)]">
            {player.wins}-{player.losses} · {winRate}%
            {player.streak >= 3 && (
              <span className="ml-1.5 text-[var(--color-win)]">🔥 {player.streak}</span>
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

/** "6-4" -> "4-6", "7-6(4)" -> "6-7(4)", "[10-8]" -> "[8-10]". */
function flipSetToken(token: string): string {
  const mtb = /^\[(\d+)-(\d+)\]$/.exec(token);
  if (mtb) return `[${mtb[2]}-${mtb[1]}]`;
  const m = /^(\d+)-(\d+)(\(\d+\))?$/.exec(token);
  if (!m) return token;
  return `${m[2]}-${m[1]}${m[3] ?? ""}`;
}
