import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer, getPlayers } from "@/lib/db";
import { relativeDay } from "@/lib/dates";
import {
  byDay,
  losers,
  pointsTable,
  relations,
  teamName,
  winRate,
  winners,
  type Relation,
} from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { getSession } from "@/lib/session";
import { RenameForm } from "@/components/rename-form";
import { signOutAction } from "../../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  return player ? { title: player.name } : { title: "Player" };
}

/**
 * A player: points, who they win with, who they beat, and every game.
 *
 * Partner and opponent records are the useful part. With one court and six
 * people the pairings rotate constantly, and "who do I actually win with?" is
 * the question that comes up.
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

  const [roster, all] = await Promise.all([getPlayers(player.group_id), getGames(player.group_id)]);
  const nameOf = (pid: string) => roster.find((p) => p.id === pid)?.name ?? "?";

  const mine = all.filter((g) => g.a.includes(id) || g.b.includes(id)); // newest first
  const row = pointsTable(all, roster.map((p) => p.id)).find((r) => r.id === id);
  const { partners, opponents } = relations(id, mine);

  const days = byDay(mine).map((d) => ({
    date: d.date,
    points: d.games.filter((g) => winners(g).includes(id)).length,
    played: d.games.length,
  }));

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
          <Stat label="Points" value={row?.points ?? 0} />
          <Stat label="Played" value={row?.played ?? 0} />
          <Stat label="Win %" value={row ? winRate(row) : "—"} />
        </dl>
      </section>

      {isMe && (
        <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <RenameForm current={player.name} />
        </section>
      )}

      {mine.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No games yet.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Relations title="With" hint="Wins when partnered" list={partners} nameOf={nameOf} />
            <Relations title="Against" hint="Wins when opposed" list={opponents} nameOf={nameOf} />
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              By day
            </h2>
            <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
              {days.map((d) => (
                <li key={d.date}>
                  <Link
                    href={`/play?d=${d.date}`}
                    className="nums flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">{relativeDay(d.date)}</span>
                    <span className="text-[var(--color-muted)]">
                      {d.points} {d.points === 1 ? "point" : "points"} from {d.played}{" "}
                      {d.played === 1 ? "game" : "games"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Games
            </h2>
            <ul className="space-y-2">
              {mine.slice(0, 40).map((g) => {
                const won = winners(g).includes(id);
                const mates = (g.a.includes(id) ? g.a : g.b).filter((x) => x !== id);
                const against = g.a.includes(id) ? g.b : g.a;
                return (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  >
                    <p className="min-w-0">
                      <span
                        className={`font-bold ${won ? "text-[var(--color-win)]" : "text-[var(--color-loss)]"}`}
                      >
                        {won ? "Won" : "Lost"}
                      </span>{" "}
                      <span className="text-[var(--color-muted)]">{mates.length ? "with" : "solo"}</span>{" "}
                      {teamName(mates, nameOf)}
                      <span className="text-[var(--color-muted)]"> v </span>
                      {teamName(against, nameOf)}
                    </p>
                    <span className="nums shrink-0 text-xs text-[var(--color-muted)]">
                      {relativeDay(g.date)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

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

function Relations({
  title,
  hint,
  list,
  nameOf,
}: {
  title: string;
  hint: string;
  list: Relation[];
  nameOf: (id: string) => string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h2>
        <p className="text-xs text-[var(--color-muted)]">{hint}</p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Nobody yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          {list.map((r) => (
            <li key={r.id} className="nums flex items-center justify-between px-3 py-2.5 text-sm">
              <Link href={`/player/${r.id}`} className="truncate font-semibold hover:underline">
                {nameOf(r.id)}
              </Link>
              <span className="text-[var(--color-muted)]">
                <span className="font-bold text-[var(--color-ink)]">{r.wins}</span> of {r.games}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
