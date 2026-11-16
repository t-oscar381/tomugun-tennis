import Link from "next/link";
import { getGroupBySlug, getPlayers } from "@/lib/db";
import { byDay, losers, pointsTable, teamName, winners } from "@/lib/games";
import { getGames } from "@/lib/gamesdb";
import { relativeDay } from "@/lib/dates";
import { EXAMPLE_SLUG } from "@/lib/league";
import { SHOTS } from "@/lib/photos";
import { Banner } from "@/components/photo";
import { Podium, PointsTable } from "@/components/points-table";

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
      <p className="rounded-xl border border-dashed border-line p-6 text-sm text-muted">
        There&apos;s no example set up at the moment.
      </p>
    );
  }

  const [players, games] = await Promise.all([getPlayers(group.id), getGames(group.id)]);
  const people = players.map((p) => ({ id: p.id, name: p.name }));
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  // Only the people who actually played: the sample league has a few stray rows.
  const table = pointsTable(games);
  const days = byDay(games);

  return (
    <div className="space-y-8">
      <Banner shot={SHOTS.hidden} eyebrow="Sample data — not real people" title="An example season">
        {table.length} made-up players and {games.length} doubles games over {days.length} play days.
        In every game the winning team&apos;s players get one point each.
      </Banner>

      {games.length === 0 ? (
        <p className="text-sm text-muted">The sample games haven&apos;t been set up yet.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_21rem] lg:items-start">
          <div className="space-y-5">
            <Podium rows={table} people={people} link={false} />
            <PointsTable rows={table} people={people} link={false} />
          </div>

          <section className="space-y-3">
            <h2 className="eyebrow text-muted">
              Latest games
            </h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {games.slice(0, 10).map((g) => (
                <li
                  key={g.id}
                  className="px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{teamName(winners(g), nameOf)}</span>
                  <span className="text-muted"> beat </span>
                  {teamName(losers(g), nameOf)}
                  <span className="block text-xs text-muted">{relativeDay(g.date)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <p className="text-center text-sm">
        <Link href="/" className="font-semibold text-clay underline">
          Back to the real group
        </Link>
      </p>
    </div>
  );
}
