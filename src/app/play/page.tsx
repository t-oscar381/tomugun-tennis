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
import { AddPlayerForm } from "@/components/add-player-form";
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
  if (!session) redirect("/join");

  const { d } = await searchParams;
  const today = jakartaDate();
  // Tomorrow is allowed — it is already tomorrow in Jakarta before it is in UTC — but no further.
  const date = d && isIsoDate(d) && d <= shiftDate(today, 1) ? d : today;

  const [players, all] = await Promise.all([getPlayers(session.group.id), getGames(session.group.id)]);

  const roster = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const people = roster.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  const games = all.filter((g) => g.date === date); // newest first
  const dayRows = pointsTable(games);
  const share = dayText(date, games, nameOf);

  const others = byDay(all)
    .filter((day) => day.date !== date)
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{relativeDay(date)}</h1>
          <p className="text-sm text-[var(--color-muted)]">{formatDayLong(date)}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/play?d=${shiftDate(date, -1)}`}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-semibold"
          >
            ← Day before
          </Link>
          {date !== today && (
            <Link
              href="/play"
              className="rounded-lg bg-[var(--color-clay)] px-3 py-2 font-bold text-white"
            >
              Back to today
            </Link>
          )}
          {date < today && (
            <Link
              href={`/play?d=${shiftDate(date, 1)}`}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 font-semibold"
            >
              Day after →
            </Link>
          )}
        </nav>
      </header>

      {players.length < 2 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
          You need at least two people in the group to log a game. Add someone below.
        </p>
      ) : (
        <GameLog players={people} date={date} />
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Games · <span className="nums">{games.length}</span>
          </h2>
          {games.length > 0 && (
            <a
              href={`https://wa.me/?text=${encodeURIComponent(share)}`}
              target="_blank"
              rel="noopener"
              className="rounded-lg bg-[var(--color-win)] px-3 py-2 text-xs font-bold text-white"
            >
              Share on WhatsApp
            </a>
          )}
        </div>

        {games.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nothing logged for this day yet.</p>
        ) : (
          <ul className="space-y-2">
            {games.map((g) => (
              <li
                key={g.id}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold">{teamName(winners(g), nameOf)}</span>
                    <span className="text-[var(--color-muted)]"> beat </span>
                    {teamName(losers(g), nameOf)}
                    <span className="nums mt-0.5 block text-xs text-[var(--color-muted)]">
                      {formatTime(g.createdAt)} · logged by {nameOf(g.loggedBy)}
                    </span>
                  </p>
                  {/* Two taps, so a stray touch can't delete a result. */}
                  <details className="shrink-0 text-right">
                    <summary className="cursor-pointer list-none text-xs text-[var(--color-muted)] underline marker:hidden">
                      Remove
                    </summary>
                    <form action={removeGameAction} className="mt-1">
                      <input type="hidden" name="gameId" value={g.id} />
                      <button className="rounded-md bg-[var(--color-loss)] px-2.5 py-1 text-xs font-bold text-white">
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Points this day
          </h2>
          <PointsTable rows={dayRows} people={people} meId={session.player.id} />
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Other days
          </h2>
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            {others.map((day) => {
              const top = pointsTable(day.games)[0];
              return (
                <li key={day.date}>
                  <Link
                    href={`/play?d=${day.date}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="font-semibold">{relativeDay(day.date)}</span>
                    <span className="nums text-sm text-[var(--color-muted)]">
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

      <section className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-bold">Someone missing?</h2>
        <AddPlayerForm label="Add a player" />
      </section>
    </div>
  );
}
