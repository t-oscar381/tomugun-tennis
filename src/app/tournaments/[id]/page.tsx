import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTournament } from "@/lib/db";
import { getSession } from "@/lib/session";
import { BracketView } from "@/components/bracket-view";
import { deleteTournamentAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTournament(id);
  return { title: t?.name ?? "Tournament" };
}

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/join");

  const { id } = await params;
  const t = await getTournament(id);
  if (!t) notFound();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/tournaments" className="text-sm text-[var(--color-muted)] hover:underline">
            ← All tournaments
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{t.name}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {t.bracket.entrants.length} {t.kind === "pair" ? "pairs" : "players"} ·{" "}
            {t.seeded ? "seeded by rank" : "random draw"}
          </p>
        </div>
      </header>

      <BracketView bracket={t.bracket} id={t.id} />

      <form action={deleteTournamentAction} className="pt-4">
        <input type="hidden" name="tournamentId" value={t.id} />
        <button className="text-xs text-[var(--color-muted)] underline">Delete this tournament</button>
      </form>
    </div>
  );
}
