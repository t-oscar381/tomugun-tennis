import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/db";
import { RP } from "@/lib/engine/ranks";
import { winChance } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { StakeNote } from "@/components/rank";
import { formatFor } from "@/lib/league";
import { LogForm } from "./log-form";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const session = await getSession();
  if (!session) redirect("/join");

  const { group, player } = session;
  const format = formatFor(group);

  const opponents = (await getPlayers(group.id))
    .filter((p) => p.id !== player.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      // Shown before you log, so the stakes are visible up front.
      winChance: Math.round(winChance(player, p) * 100),
    }));

  const inPlacements = player.matches < RP.placementMatches;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">Log a match</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Three taps and a score. Fill it in{" "}
          <span className="text-[var(--color-ink)]">from your own side</span> — your games first,
          win or lose. Your opponent confirms before anything moves.
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          Not sure how to write the score?{" "}
          <Link href="/how" className="text-[var(--color-clay)] underline">
            See the examples
          </Link>
        </p>
      </div>

      {inPlacements ? (
        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-muted)]">
          Placement match {player.matches + 1} of {RP.placementMatches} — no RP at stake yet.
        </p>
      ) : (
        <StakeNote rp={player.rp} />
      )}

      {opponents.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Nobody else has joined this league yet.
        </p>
      ) : (
        <LogForm
          meId={player.id}
          opponents={opponents}
          placeholder={format.decidingSetIsMatchTiebreak ? "6-4 3-6 [10-8]" : "6-4 3-6 7-5"}
        />
      )}
    </div>
  );
}
