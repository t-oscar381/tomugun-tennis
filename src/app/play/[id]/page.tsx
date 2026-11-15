import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPlayDay, getPlayers, sessionsReady } from "@/lib/db";
import { formatDayLong, relativeDay } from "@/lib/dates";
import { formatFor } from "@/lib/league";
import { matchesOn } from "@/lib/playday";
import { getSession } from "@/lib/session";
import { flipScore, nightText, tally } from "@/lib/summary";
import { AddPlayerForm } from "@/components/add-player-form";
import { PlaySetup } from "@/components/play-setup";
import { removePlayDayMatchAction, togglePresentAction } from "@/app/actions";
import { PlayDayLog } from "./play-day-log";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const day = (await sessionsReady()) ? await getPlayDay(id) : null;
  return { title: day ? `Play day · ${relativeDay(day.played_on)}` : "Play day" };
}

export default async function PlayDayPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/join");
  if (!(await sessionsReady())) return <PlaySetup />;

  const { id } = await params;
  const day = await getPlayDay(id);
  if (!day || day.group_id !== session.group.id) notFound();

  const [players, matches] = await Promise.all([
    getPlayers(session.group.id),
    matchesOn(session.group.id, day.played_on),
  ]);

  const byId = new Map(players.map((p) => [p.id, p]));
  const nameOf = (pid: string) => byId.get(pid)?.name ?? "?";

  // Here = ticked, plus anyone who has a match tonight even if they were never ticked.
  const played = new Set(matches.flatMap((m) => [m.player_a, m.player_b]));
  const hereIds = [...new Set([...day.attendees, ...played])].filter((pid) => byId.has(pid));
  const here = hereIds
    .map((pid) => byId.get(pid)!)
    .sort((a, b) => a.name.localeCompare(b.name));

  const rows = tally(matches, hereIds);
  const me = session.player.id;
  const iAmHere = hereIds.includes(me);

  const share = nightText(day.played_on, matches, hereIds, nameOf);
  const everyone = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/play" className="text-sm text-[var(--color-muted)] hover:underline">
            ← All play days
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{relativeDay(day.played_on)}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {formatDayLong(day.played_on)} · <span className="nums">{here.length}</span> here ·{" "}
            <span className="nums">{matches.length}</span> {matches.length === 1 ? "match" : "matches"}
          </p>
        </div>
        {matches.length > 0 && (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(share)}`}
            target="_blank"
            rel="noopener"
            className="rounded-lg bg-[var(--color-win)] px-4 py-2.5 text-sm font-bold text-white"
          >
            Share tonight on WhatsApp
          </a>
        )}
      </header>

      <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-sm">
        {iAmHere ? (
          <>
            <strong>You&apos;re playing tonight.</strong>{" "}
            <span className="text-[var(--color-muted)]">
              Whoever&apos;s resting can log for everyone, or log your own — the form works for any two
              people here.
            </span>
          </>
        ) : (
          <>
            <strong>You&apos;re not on tonight&apos;s list — you can referee.</strong>{" "}
            <span className="text-[var(--color-muted)]">
              Log each result for whoever played. It&apos;s recorded as logged by {session.player.name}.
            </span>
          </>
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          {here.length < 2 ? (
            <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
              Tick at least two people as here, and the log form appears.
            </p>
          ) : (
            <PlayDayLog
              sessionId={day.id}
              present={here.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))}
              format={formatFor(session.group)}
            />
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Matches
            </h2>
            {matches.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {[...matches].reverse().map((m) => {
                  const loser = m.winner_id === m.player_a ? m.player_b : m.player_a;
                  const score = m.winner_id === m.player_a ? m.scoreline : flipScore(m.scoreline);
                  return (
                    <li
                      key={m.id}
                      className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 text-sm">
                          <span className="font-semibold">{nameOf(m.winner_id)}</span>
                          <span className="text-[var(--color-muted)]"> beat </span>
                          {nameOf(loser)}
                          <span className="nums mt-0.5 block text-xs text-[var(--color-muted)]">
                            {score} · logged by {nameOf(m.logged_by)}
                          </span>
                        </p>
                        {/* Two taps, so a stray touch can't delete a result. */}
                        <details className="shrink-0 text-right">
                          <summary className="cursor-pointer list-none text-xs text-[var(--color-muted)] underline marker:hidden">
                            Remove
                          </summary>
                          <form action={removePlayDayMatchAction} className="mt-1">
                            <input type="hidden" name="matchId" value={m.id} />
                            <button className="rounded-md bg-[var(--color-loss)] px-2.5 py-1 text-xs font-bold text-white">
                              Yes, remove it
                            </button>
                          </form>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
            <div>
              <h2 className="font-bold">Who&apos;s here</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Tap to tick or untick. Anyone who has played tonight stays ticked.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {everyone.map((p) => {
                const on = hereIds.includes(p.id);
                const locked = played.has(p.id);
                return (
                  <form key={p.id} action={togglePresentAction}>
                    <input type="hidden" name="sessionId" value={day.id} />
                    <input type="hidden" name="playerId" value={p.id} />
                    <input type="hidden" name="present" value={on ? "0" : "1"} />
                    <button
                      disabled={locked}
                      aria-pressed={on}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors disabled:cursor-default ${
                        on
                          ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white"
                          : "border-[var(--color-line)] text-[var(--color-muted)]"
                      }`}
                    >
                      <span aria-hidden>{p.emoji}</span>
                      {p.name}
                    </button>
                  </form>
                );
              })}
            </div>
            <div className="border-t border-[var(--color-line)] pt-3">
              <AddPlayerForm sessionId={day.id} label="Someone new? Add them here" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Tonight
            </h2>
            <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="nums flex items-center gap-3 border-b border-[var(--color-line)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                <span className="flex-1">Player</span>
                <span className="w-9 text-center">Pl</span>
                <span className="w-9 text-center">W</span>
                <span className="w-9 text-center">L</span>
              </div>
              <ul className="divide-y divide-[var(--color-line)]">
                {rows.map((r) => (
                  <li key={r.id} className="nums flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(r.id)}</span>
                    <span className="w-9 text-center text-[var(--color-muted)]">{r.played}</span>
                    <span className="w-9 text-center font-semibold">{r.won}</span>
                    <span className="w-9 text-center text-[var(--color-muted)]">{r.lost}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
