import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/db";
import { formatDayLong, formatTime, isIsoDate, jakartaDate, relativeDay, shiftDate } from "@/lib/dates";
import {
  byDay,
  dayText,
  losers,
  pointsTable,
  teamName,
  winners,
} from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { getSession } from "@/lib/session";
import { SHOTS } from "@/lib/photos";
import { AddPlayerForm } from "@/components/add-player-form";
import { Avatar } from "@/components/avatar";
import { Banner } from "@/components/photo";
import { PointsTable } from "@/components/points-table";
import { removeGameAction } from "@/app/actions";
import { GameLog } from "./game-log";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log a game" };

/**
 * The day's page: log games, see the day's points, undo a mistake.
 *
 * There is one court, so there is one day at a time and it is this page. It
 * opens on today; `?d=` moves to another date, for logging last night's games
 * this morning or checking what happened last week.
 */
export default async function PlayPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const session = await getSession();
  const { d } = await searchParams;
  // Not signed in: go and sign in, then come straight back to this day.
  if (!session) {
    const here = d && isIsoDate(d) ? `/play?d=${d}` : "/play";
    redirect(`/join?next=${encodeURIComponent(here)}`);
  }

  const today = jakartaDate();
  // Tomorrow is allowed — it is already tomorrow in Jakarta before it is in UTC — but no further.
  const date = d && isIsoDate(d) && d <= shiftDate(today, 1) ? d : today;

  const [players, all] = await Promise.all([getPlayers(session.group.id), getGames(session.group.id)]);

  const roster = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const people = roster.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }));
  const petFor = (id: string) => players.find((p) => p.id === id)?.emoji;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  const games = all.filter((g) => g.date === date); // newest first
  const dayRows = pointsTable(games);
  const share = dayText(date, games, nameOf);

  const others = byDay(all)
    .filter((day) => day.date !== date)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Banner
        shot={date === today ? SHOTS.net : SHOTS.dusk}
        eyebrow={`${games.length} ${games.length === 1 ? "game" : "games"} logged`}
        title={relativeDay(date)}
        aside={
          <nav className="flex flex-wrap items-center gap-2">
            <Link href={`/play?d=${shiftDate(date, -1)}`} className="rounded-full border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
              ← Day before
            </Link>
            {date < today && (
              <Link href={`/play?d=${shiftDate(date, 1)}`} className="rounded-full border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                Day after →
              </Link>
            )}
            {date !== today && (
              <Link href="/play" className="rounded-full bg-lime px-3.5 py-2 text-sm font-bold text-court-deep">
                Back to today
              </Link>
            )}
          </nav>
        }
      >
        {formatDayLong(date)}
      </Banner>

      {players.length < 2 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
          You need at least two people in the group to log a game. Add someone below.
        </p>
      ) : (
        <GameLog players={people} date={date} />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="eyebrow text-muted">
            Games · <span className="nums">{games.length}</span>
          </h2>
          {games.length > 0 && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(share)}`}
              target="_blank"
              rel="noopener"
              className="rounded-full bg-win px-4 py-2 text-xs font-bold text-white"
            >
              Share on WhatsApp
            </a>
          )}
        </div>

        {games.length === 0 ? (
          <p className="text-sm text-muted">Nothing logged for this day yet.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {games.map((g, i) => (
              <li
                key={g.id}
                className="px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <span className="display nums w-7 shrink-0 text-lg italic text-muted">
                    {games.length - i}
                  </span>
                  <span className="flex shrink-0 -space-x-2">
                    {winners(g).map((id) => (
                      <Avatar key={id} id={id} name={nameOf(id)} pet={petFor(id)} size={34} className="ring-2 ring-surface" />
                    ))}
                  </span>
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">{teamName(winners(g), nameOf)}</span>
                    <span className="text-muted"> beat </span>
                    {teamName(losers(g), nameOf)}
                    <span className="nums mt-0.5 block text-xs text-muted">
                      {formatTime(g.createdAt)} · logged by {nameOf(g.loggedBy)}
                    </span>
                  </p>
                  {/* Two taps, so a stray touch can't delete a result. */}
                  <details className="shrink-0 text-right">
                    <summary className="cursor-pointer list-none text-xs text-muted underline marker:hidden">
                      Remove
                    </summary>
                    <form action={removeGameAction} className="mt-1">
                      <input type="hidden" name="gameId" value={g.id} />
                      <button className="rounded-md bg-loss px-2.5 py-1 text-xs font-bold text-white">
                        Yes, remove it
                      </button>
                    </form>
                  </details>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dayRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow text-muted">
            Points this day
          </h2>
          <PointsTable rows={dayRows} people={people} meId={session.player.id} />
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow text-muted">
            Other days
          </h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {others.map((day) => {
              const top = pointsTable(day.games)[0];
              return (
                <li key={day.date}>
                  <Link
                    href={`/play?d=${day.date}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/70"
                  >
                    <span className="font-semibold">{relativeDay(day.date)}</span>
                    <span className="nums text-sm text-muted">
                      {day.games.length} {day.games.length === 1 ? "game" : "games"}
                      {top ? ` · top: ${nameOf(top.id)} ${top.points}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="text-xl">Someone missing?</h2>
        <AddPlayerForm label="Add a player" />
      </section>
    </div>
  );
}
