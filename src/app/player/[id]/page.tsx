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
import { SHOTS } from "@/lib/photos";
import { Avatar } from "@/components/avatar";
import { Banner } from "@/components/photo";
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
    <div className="mx-auto max-w-3xl space-y-8">
      {renamed && (
        <p className="rounded-xl border border-win/40 bg-win/10 px-4 py-3 text-sm">
          Name saved.
        </p>
      )}

      <Banner
        shot={SHOTS.backhand}
        eyebrow={isMe ? "Your record" : "Player"}
        title={
          <span className="flex items-center gap-4">
            <Avatar id={player.id} name={player.name} size={56} ring="var(--color-lime)" />
            <span className="truncate">{player.name}</span>
          </span>
        }
        aside={
          <dl className="nums flex gap-7 text-left">
            <Stat label={row?.points === 1 ? "Point" : "Points"} value={row?.points ?? 0} lead />
            <Stat label="Played" value={row?.played ?? 0} />
            <Stat label="Wins" value={row ? winRate(row) : "—"} />
          </dl>
        }
      />

      {isMe && (
        <section className="card p-5">
          <RenameForm current={player.name} />
        </section>
      )}

      {mine.length === 0 ? (
        <p className="text-sm text-muted">No games yet.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Relations title="With" hint="Wins when partnered" list={partners} nameOf={nameOf} />
            <Relations title="Against" hint="Wins when opposed" list={opponents} nameOf={nameOf} />
          </div>

          <section className="space-y-3">
            <h2 className="eyebrow text-muted">
              By day
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {days.map((d) => (
                <li key={d.date}>
                  <Link
                    href={`/play?d=${d.date}`}
                    className="nums flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">{relativeDay(d.date)}</span>
                    <span className="text-muted">
                      {d.points} {d.points === 1 ? "point" : "points"} from {d.played}{" "}
                      {d.played === 1 ? "game" : "games"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="eyebrow text-muted">
              Games
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {mine.slice(0, 40).map((g) => {
                const won = winners(g).includes(id);
                const mates = (g.a.includes(id) ? g.a : g.b).filter((x) => x !== id);
                const against = g.a.includes(id) ? g.b : g.a;
                return (
                  <li
                    key={g.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <p className="min-w-0">
                      <span
                        className={`eyebrow mr-2 inline-block w-11 rounded-full py-1 text-center !text-[9px] text-white ${won ? "bg-win" : "bg-loss/85"}`}
                      >
                        {won ? "Won" : "Lost"}
                      </span>
                      <span className="text-muted">{mates.length ? "with" : "solo"}</span>{" "}
                      {teamName(mates, nameOf)}
                      <span className="text-muted"> v </span>
                      {teamName(against, nameOf)}
                    </p>
                    <span className="nums shrink-0 text-xs text-muted">
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
          <button className="text-xs text-muted underline">Not you? Sign out</button>
        </form>
      )}
    </div>
  );
}

function Stat({ label, value, lead }: { label: string; value: number | string; lead?: boolean }) {
  return (
    <div>
      <dd className={`display leading-none ${lead ? "text-5xl text-lime" : "text-3xl"}`}>{value}</dd>
      <dt className="eyebrow mt-1.5 text-white/65">{label}</dt>
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
        <h2 className="eyebrow text-muted">{title}</h2>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-muted">Nobody yet.</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {list.map((r) => (
            <li key={r.id} className="nums flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <Link href={`/player/${r.id}`} className="flex min-w-0 items-center gap-2.5 font-semibold hover:underline">
                <Avatar id={r.id} name={nameOf(r.id)} size={28} />
                <span className="truncate">{nameOf(r.id)}</span>
              </Link>
              <span className="text-muted">
                <span className="font-bold text-ink">{r.wins}</span> of {r.games}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
