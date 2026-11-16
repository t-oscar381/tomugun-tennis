import Link from "next/link";
import { getGroupBySlug, getPlayers } from "@/lib/db";
import { jakartaDate, relativeDay } from "@/lib/dates";
import { losers, pointsTable, teamName, winners } from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { GROUP_SLUG } from "@/lib/league";
import { getSession } from "@/lib/session";
import { InviteCard } from "@/components/invite-card";
import { PointsTable } from "@/components/points-table";
import { RenameForm } from "@/components/rename-form";
import { FlowDiagram, Hero, JoinCta, PhotoStrip, Steps } from "@/components/how-it-works";

// Every view here changes the moment a game is logged, so nothing is
// prerendered. (No runtime = "edge" — it breaks page loading under OpenNext.)
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) return <Welcome />;

  const { group, player } = session;
  const [players, games] = await Promise.all([getPlayers(group.id), getGames(group.id)]);

  const people = players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  const table = pointsTable(games, players.map((p) => p.id));
  const mine = table.find((r) => r.id === player.id);
  const today = jakartaDate();
  const todays = games.filter((g) => g.date === today);
  const todayRows = pointsTable(todays);
  // The roster started as single letters; nudge whoever claimed one to put their real name on it.
  const placeholder = player.name.length === 1;

  return (
    <div className="space-y-6">
      {placeholder && (
        <section className="space-y-2 rounded-2xl border-2 border-[var(--color-clay)]/50 bg-[var(--color-surface)] p-5">
          <h2 className="font-bold">You&apos;re signed in as &ldquo;{player.name}&rdquo;</h2>
          <p className="text-sm text-[var(--color-muted)]">
            That&apos;s a placeholder. Put your name on it so the others know who scored.
          </p>
          <RenameForm current={player.name} />
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-2xl"
          >
            {player.emoji}
          </span>
          <div>
            <p className="text-xs text-[var(--color-muted)]">{group.name}</p>
            <h1 className="text-xl font-bold tracking-tight">{player.name}</h1>
          </div>
        </div>
        <p className="nums text-right">
          <span className="text-3xl font-bold">{mine?.points ?? 0}</span>
          <span className="block text-xs text-[var(--color-muted)]">
            points · {mine?.played ?? 0} {mine?.played === 1 ? "game" : "games"}
          </span>
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Points</h2>
            <span className="text-sm text-[var(--color-muted)]">
              {games.length} {games.length === 1 ? "game" : "games"} so far
            </span>
          </div>
          <PointsTable rows={table} people={people} meId={player.id} />
        </section>

        <aside className="space-y-6">
          <Link href="/play" className="block rounded-xl bg-[var(--color-clay)] px-5 py-4 text-white">
            <span className="flex items-center justify-between font-bold">
              <span>Log a game</span>
              <span aria-hidden>→</span>
            </span>
            <span className="nums mt-0.5 block text-sm opacity-90">
              {todays.length === 0
                ? "Nothing logged today yet"
                : `${todays.length} ${todays.length === 1 ? "game" : "games"} logged today`}
            </span>
          </Link>

          {todayRows.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Today
              </h2>
              <ul className="space-y-1.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
                {todayRows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="truncate font-semibold">{nameOf(r.id)}</span>
                    <span className="nums font-bold">{r.points}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <InviteCard
            inviteUrl={`${process.env.SITE_URL ?? "https://play-tennis.tomugun.com"}/join?c=${encodeURIComponent(group.join_code)}`}
            code={group.join_code}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Latest games
            </h2>
            {games.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No games yet.</p>
            ) : (
              <ul className="space-y-2">
                {games.slice(0, 8).map((g) => (
                  <li
                    key={g.id}
                    className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{teamName(winners(g), nameOf)}</span>
                    <span className="text-[var(--color-muted)]"> beat </span>
                    {teamName(losers(g), nameOf)}
                    <span className="block text-xs text-[var(--color-muted)]">{relativeDay(g.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <p className="text-center text-sm text-[var(--color-muted)]">
        <Link href="/how" className="text-[var(--color-clay)] underline">
          How it works
        </Link>
        <span aria-hidden className="mx-2">·</span>
        <Link href="/example" className="text-[var(--color-clay)] underline">
          See an example season
        </Link>
      </p>
    </div>
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

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-bold">Want to see it with a season in it?</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          There&apos;s a sample group with made-up players and a few weeks of games.
        </p>
        <Link href="/example" className="mt-2 inline-block font-semibold text-[var(--color-clay)] underline">
          Look at the example
        </Link>
      </section>

      <PhotoStrip />

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">Anyone can log it</h3>
          <p className="text-sm text-[var(--color-muted)]">
            One court, six people watching. Whoever has their phone out taps who won — it
            doesn&apos;t have to be someone in the game.
          </p>
        </div>
        <div className="space-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h3 className="font-bold">It remembers who plays well together</h3>
          <p className="text-sm text-[var(--color-muted)]">
            Every player page shows your record with each partner and against each opponent, so
            the argument about who to pair up has an answer.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-md">
        <JoinCta label="Ready — let me in" />
      </div>
    </div>
  );
}
