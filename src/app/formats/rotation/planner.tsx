"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { generateRotation, minimumPlayers, type TeamSize } from "@/lib/engine/rotation";

/**
 * The rotation planner.
 *
 * Runs entirely in the browser: the schedule is a pure function of who is
 * here, and nothing is worth persisting until someone actually plays a match.
 * That also means "shuffle" is instant and costs nothing.
 */

interface Person {
  id: string;
  name: string;
  emoji: string;
}

export function RotationPlanner({
  players,
  teamSize,
  meId,
}: {
  players: Person[];
  teamSize: TeamSize;
  meId: string;
}) {
  // Default to everyone present, with you ticked — the common case on a club
  // night is "most of us are here", not "let me build a list from nothing".
  const [selected, setSelected] = useState<Set<string>>(new Set(players.map((p) => p.id)));
  const [courts, setCourts] = useState(2);
  const [rounds, setRounds] = useState(5);
  const [seed, setSeed] = useState(1);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const ids = players.filter((p) => selected.has(p.id)).map((p) => p.id);
  const min = minimumPlayers(teamSize);

  const schedule = useMemo(
    () =>
      ids.length >= min
        ? generateRotation({ playerIds: ids, rounds, courts, teamSize, seed })
        : null,
    [ids, rounds, courts, teamSize, seed, min],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const name = (id: string) => byId.get(id)?.name ?? "?";

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <div className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <div>
          <h2 className="font-bold">Who&apos;s here?</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {ids.length} of {players.length} playing
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                  on
                    ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white"
                    : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
                }`}
              >
                <span aria-hidden>{p.emoji}</span>
                {p.name}
                {p.id === meId && <span className="text-[10px] font-bold uppercase">you</span>}
              </button>
            );
          })}
        </div>

        <Stepper label="Courts" value={courts} min={1} max={6} onChange={setCourts} />
        <Stepper label="Rounds" value={rounds} min={1} max={12} onChange={setRounds} />

        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3 font-bold text-white"
        >
          Shuffle the draw
        </button>

        {schedule && (
          <dl className="grid grid-cols-2 gap-3 border-t border-[var(--color-line)] pt-4 text-sm">
            <Stat label="Repeat partners" value={teamSize === 2 ? schedule.repeatPartners : "—"} />
            <Stat label="Repeat opponents" value={schedule.repeatOpponents} />
          </dl>
        )}
      </div>

      <div className="space-y-4">
        {!schedule ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
            Tick at least {min} players to draw a {teamSize === 2 ? "doubles" : "singles"} rotation.
          </p>
        ) : (
          <>
            {schedule.rounds.map((round) => (
              <section
                key={round.round}
                className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)]"
              >
                <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-2.5">
                  <h3 className="font-bold">Round {round.round}</h3>
                  {round.resting.length > 0 && (
                    <p className="text-xs text-[var(--color-muted)]">
                      Sitting out: {round.resting.map(name).join(", ")}
                    </p>
                  )}
                </header>

                <ul className="divide-y divide-[var(--color-line)]">
                  {round.matches.map((m) => (
                    <li key={m.court} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Court {m.court}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-right font-semibold">
                          {m.teamA.map(name).join(" & ")}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--color-muted)]">v</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">
                          {m.teamB.map(name).join(" & ")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
              {teamSize === 1 ? (
                <>
                  These are ordinary singles matches, so{" "}
                  <Link href="/log" className="font-semibold text-[var(--color-clay)] underline">
                    log each result
                  </Link>{" "}
                  and the ladder moves as usual.
                </>
              ) : (
                <>
                  Doubles results aren&apos;t ranked yet — rating a pair needs a team model this
                  ladder doesn&apos;t run. Play it as a social night; the draw above is the useful
                  part.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="size-10 rounded-lg border border-[var(--color-line)] text-lg font-bold disabled:opacity-30"
        >
          −
        </button>
        <span className="nums w-8 text-center text-lg font-bold">{value}</span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="size-10 rounded-lg border border-[var(--color-line)] text-lg font-bold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-muted)]">{label}</dt>
      <dd className="nums text-lg font-bold">{value}</dd>
    </div>
  );
}
