import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayers, getTournaments, tournamentsReady } from "@/lib/db";
import { champion, progress } from "@/lib/engine/bracket";
import { getSession } from "@/lib/session";
import { NewTournament } from "./new-tournament";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  const session = await getSession();
  if (!session) redirect("/join");

  const ready = await tournamentsReady();
  const [tournaments, players] = await Promise.all([
    ready ? getTournaments(session.group.id) : Promise.resolve([]),
    getPlayers(session.group.id),
  ]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          A one-off knockout. Everyone in, one draw, lose once and you&apos;re out — last one
          standing is king. Nothing here touches the running ladder.
        </p>
      </header>

      {!ready ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-line)] p-6">
          <h2 className="font-bold">One database update needed</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Tournaments live in a new table. Run{" "}
            <code className="text-[var(--color-ink)]">supabase/schema.sql</code> against the
            Supabase project — the file is idempotent, so re-running the whole thing is safe — then
            reload this page.
          </p>
        </div>
      ) : (
        <>
          <NewTournament
            players={players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, rp: p.rp }))}
            meId={session.player.id}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Past draws</h2>
            {tournaments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
                No tournaments yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
                {tournaments.map((t) => {
                  const king = champion(t.bracket);
                  const { played, total } = progress(t.bracket);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/tournaments/${t.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.name}</span>
                          <span className="nums block text-xs text-[var(--color-muted)]">
                            {t.bracket.entrants.length} {t.kind === "pair" ? "pairs" : "players"} ·{" "}
                            {played}/{total} played
                          </span>
                        </span>
                        {king ? (
                          <span className="shrink-0 rounded-full bg-[var(--color-gold)]/15 px-3 py-1 text-xs font-bold text-[var(--color-gold)]">
                            👑 {king.name}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-[var(--color-clay)]">
                            In progress →
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
