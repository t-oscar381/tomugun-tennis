import Link from "next/link";
import { redirect } from "next/navigation";
import { getMatches, getPlayers, listPlayDays, sessionsReady } from "@/lib/db";
import { dateOf, jakartaDate, relativeDay } from "@/lib/dates";
import { getSession } from "@/lib/session";
import { AddPlayerForm } from "@/components/add-player-form";
import { PlaySetup } from "@/components/play-setup";
import { StartPlayDay } from "./start-play-day";

export const dynamic = "force-dynamic";
export const metadata = { title: "Play days" };

export default async function PlayDaysPage() {
  const session = await getSession();
  if (!session) redirect("/join");

  if (!(await sessionsReady())) return <PlaySetup />;

  const { group } = session;
  const today = jakartaDate();

  const [players, days, recent] = await Promise.all([
    getPlayers(group.id),
    listPlayDays(group.id),
    getMatches(group.id, { limit: 500, status: "confirmed" }),
  ]);

  const perDay = new Map<string, number>();
  for (const m of recent) {
    const d = dateOf(m.played_at);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const todays = days.find((d) => d.played_on === today);
  const roster = [...players].sort((a, b) => a.name.localeCompare(b.name));
  // Last time's crowd is the best guess for this time's.
  const lastCrowd = days.find((d) => d.played_on !== today)?.attendees ?? [];
  const known = new Set(players.map((p) => p.id));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Play days</h1>
        <p className="text-[var(--color-muted)]">
          One per date. Tick who turned up, then log the night&apos;s matches against it — someone
          resting can do the logging for everyone.
        </p>
      </header>

      {todays && (
        <Link
          href={`/play/${todays.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-clay)] px-5 py-4 text-white"
        >
          <span>
            <span className="block text-lg font-bold">Today&apos;s play day</span>
            <span className="nums block text-sm opacity-90">
              {todays.attendees.length} here · {perDay.get(today) ?? 0} matches logged
            </span>
          </span>
          <span className="font-bold">Open &amp; log →</span>
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{todays ? "Start another date" : "Start a play day"}</h2>
        <StartPlayDay
          players={roster.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))}
          defaultDate={today}
          defaultIds={lastCrowd.filter((id) => known.has(id))}
          maxDate={jakartaDate(new Date(Date.now() + 24 * 3600 * 1000))}
        />
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-bold">Someone missing from the list?</h2>
        <AddPlayerForm label="Add a player" />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Past play days
        </h2>
        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
            None yet. The first one you start will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
            {days.map((d) => (
              <li key={d.id}>
                <Link href={`/play/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-semibold">{relativeDay(d.played_on)}</span>
                  <span className="nums text-sm text-[var(--color-muted)]">
                    {d.attendees.length} here · {perDay.get(d.played_on) ?? 0} matches
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
