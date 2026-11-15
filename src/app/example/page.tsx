import Link from "next/link";
import { getGroupBySlug, getMatches, getPlayers } from "@/lib/db";
import { EXAMPLE_SLUG } from "@/lib/league";
import { ResultsList, Standings } from "@/components/standings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Example season" };

/**
 * A sample league, readable by anyone, changeable by no one.
 *
 * These are the made-up players and simulated matches the app was built
 * against. They live in their own group so they can never appear in the real
 * records, and this page has no forms and no actions on purpose.
 */
export default async function ExamplePage() {
  const group = await getGroupBySlug(EXAMPLE_SLUG);

  if (!group) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
        There&apos;s no example season set up at the moment.
      </p>
    );
  }

  const [players, recent] = await Promise.all([
    getPlayers(group.id),
    getMatches(group.id, { limit: 15, status: "confirmed" }),
  ]);
  const played = players.reduce((n, p) => n + p.wins, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="inline-block rounded-full bg-[var(--color-clay-soft)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--color-clay)]">
          Sample data — not real people
        </p>
        <h1 className="text-2xl font-bold tracking-tight">An example season</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          {players.length} made-up players and {played} simulated matches, so you can see what the
          record book looks like once a group has been playing for a while. Tap a name to see
          their head-to-heads.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Standings players={players} showRanks />
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Recent results
          </h2>
          <ResultsList matches={recent} players={players} />
        </section>
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="font-semibold text-[var(--color-clay)] underline">
          Back to the real league
        </Link>
      </p>
    </div>
  );
}
