import Link from "next/link";
import { getGroupBySlug, getPlayers } from "@/lib/db";
import { byDay, losers, pointsTable, teamName, winners } from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { relativeDay } from "@/lib/dates";
import { EXAMPLE_SLUG } from "@/lib/league";
import { PointsTable } from "@/components/points-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Example season" };

/**
 * A sample group, readable by anyone, changeable by no one.
 *
 * Made-up players and simulated doubles games, so you can see what the
 * scoreboard looks like after a few weeks. They live in their own group so they
 * never mix with real results, and this page has no forms and no actions.
 */
export default async function ExamplePage() {
  const group = await getGroupBySlug(EXAMPLE_SLUG);
  if (!group) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
        There&apos;s no example set up at the moment.
      </p>
    );
  }

  const [players, games] = await Promise.all([getPlayers(group.id), getGames(group.id)]);
  const people = players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  // Only the people who actually played: the sample league has a few stray rows.
  const table = pointsTable(games);
  const days = byDay(games);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="inline-block rounded-full bg-[var(--color-clay-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-clay)]">
          Sample data — not real people
        </p>
        <h1 className="text-2xl font-bold tracking-tight">An example season</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          {table.length} made-up players and {games.length} doubles games over {days.length} weeks. In
          every game the winning team&apos;s players get one point each.
        </p>
      </header>

      {games.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">The sample games haven&apos;t been set up yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
          <PointsTable rows={table} people={people} link={false} />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Latest games
            </h2>
            <ul className="space-y-2">
              {games.slice(0, 10).map((g) => (
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
          </section>
        </div>
      )}

      <p className="text-center text-sm">
        <Link href="/" className="font-semibold text-[var(--color-clay)] underline">
          Back to the real group
        </Link>
      </p>
    </div>
  );
}
