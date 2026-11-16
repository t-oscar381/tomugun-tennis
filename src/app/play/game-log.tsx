"use client";

import { useActionState, useEffect, useState } from "react";
import { logGameAction } from "@/app/actions";
import { MAX_TEAM } from "@/lib/games";

interface Person {
  id: string;
  name: string;
  emoji: string;
}

/**
 * Log a game: tap the people on each team, tap the team that won.
 *
 * That is the whole form. There is no score to enter — the 15-30-45 you play to
 * stays on court — and no "you", because whoever is holding the phone is
 * usually not in the game. Teams are one or two people.
 */
export function GameLog({ players, date }: { players: Person[]; date: string }) {
  const [state, action, pending] = useActionState(logGameAction, {});
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);

  // A successful log empties the form, ready for the next game.
  useEffect(() => {
    if (state.ok) {
      setA([]);
      setB([]);
    }
  }, [state.stamp, state.ok]);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const label = (ids: string[], fallback: string) => (ids.length ? ids.map(nameOf).join(" & ") : fallback);
  const ready = a.length > 0 && b.length > 0;

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="a" value={a.join(",")} />
      <input type="hidden" name="b" value={b.join(",")} />

      <div>
        <h2 className="text-lg font-bold tracking-tight">Log a game</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Tap the people on each team, then tap the team that won. Everyone on it gets a point.
        </p>
      </div>

      {state.ok && (
        <p className="rounded-lg border border-[var(--color-win)]/40 bg-[var(--color-win)]/10 px-3 py-2 text-sm">
          <strong>Logged:</strong> {state.ok}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Team title="Team 1" tone="clay" ids={a} other={b} players={players} onChange={setA} />
        <Team title="Team 2" tone="court" ids={b} other={a} players={players} onChange={setB} />
      </div>

      {state.error && (
        <p className="rounded-lg border border-[var(--color-loss)]/40 bg-[var(--color-loss)]/10 px-3 py-2 text-sm text-[var(--color-loss)]">
          {state.error}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold">Who won?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            name="win"
            value="a"
            disabled={pending || !ready}
            className="rounded-xl bg-[var(--color-clay)] px-4 py-4 text-left font-bold text-white disabled:opacity-35"
          >
            <span className="block text-xs font-semibold opacity-80">Team 1 won</span>
            <span className="block text-lg leading-tight">{label(a, "—")}</span>
          </button>
          <button
            name="win"
            value="b"
            disabled={pending || !ready}
            className="rounded-xl bg-[var(--color-court)] px-4 py-4 text-left font-bold text-white disabled:opacity-35"
          >
            <span className="block text-xs font-semibold opacity-80">Team 2 won</span>
            <span className="block text-lg leading-tight">{label(b, "—")}</span>
          </button>
        </div>
        {!ready && <p className="text-xs text-[var(--color-muted)]">Pick at least one person on each team first.</p>}
      </div>
    </form>
  );
}

function Team({
  title,
  tone,
  ids,
  other,
  players,
  onChange,
}: {
  title: string;
  tone: "clay" | "court";
  ids: string[];
  other: string[];
  players: Person[];
  onChange: (ids: string[]) => void;
}) {
  const on = tone === "clay" ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white" : "border-[var(--color-court)] bg-[var(--color-court)] text-white";
  const full = ids.length >= MAX_TEAM;

  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : full ? ids : [...ids, id]);

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">
        {title} <span className="font-normal text-[var(--color-muted)]">({ids.length}/{MAX_TEAM})</span>
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => {
          const picked = ids.includes(p.id);
          // On the other team already, or this team is full: not available.
          const blocked = other.includes(p.id) || (full && !picked);
          return (
            <button
              key={p.id}
              type="button"
              disabled={blocked}
              aria-pressed={picked}
              onClick={() => toggle(p.id)}
              className={`truncate rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors disabled:opacity-25 ${
                picked ? on : "border-[var(--color-line)] bg-[var(--color-bg)]"
              }`}
            >
              {p.emoji} {p.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
