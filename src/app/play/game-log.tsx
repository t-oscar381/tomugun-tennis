"use client";

import { useActionState, useEffect, useState } from "react";
import { logGameAction } from "@/app/actions";
import { MAX_TEAM } from "@/lib/games";
import { Avatar } from "@/components/avatar";

interface Person {
  id: string;
  name: string;
}

/**
 * Log a game: tap the people on each team, tap the team that won.
 *
 * That is the whole form. There is no score to enter — the 15-30-45 you play to
 * stays on court — and no "you", because whoever is holding the phone is
 * usually not in the game. Teams are one or two people.
 *
 * Laid out as a court: one side clay, one side green, a net between them.
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
  const label = (ids: string[]) => (ids.length ? ids.map(nameOf).join(" & ") : "—");
  const ready = a.length > 0 && b.length > 0;

  return (
    <form action={action} className="card overflow-hidden">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="a" value={a.join(",")} />
      <input type="hidden" name="b" value={b.join(",")} />

      <div className="p-5 sm:p-6">
        <p className="eyebrow text-clay">New game</p>
        <h2 className="mt-1 text-2xl">Who played, and who won?</h2>
        <p className="mt-1 text-sm text-muted">
          Tap the people on each team, then tap the team that won. Everyone on it gets a point.
        </p>

        {state.ok && (
          <p
            key={state.stamp}
            role="status"
            className="rise mt-4 flex items-center gap-2.5 rounded-xl border border-win/30 bg-win/10 px-4 py-3 text-sm"
          >
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-win text-xs font-bold text-white">
              ✓
            </span>
            <span>
              <strong>Logged:</strong> {state.ok}
            </span>
          </p>
        )}
      </div>

      {/* The court. */}
      <div className="relative grid sm:grid-cols-2">
        <Team title="Team 1" tone="clay" ids={a} other={b} players={players} onChange={setA} />
        <Team title="Team 2" tone="court" ids={b} other={a} players={players} onChange={setB} />
        <span
          aria-hidden
          className="eyebrow absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-md"
        >
          vs
        </span>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {state.error && (
          <p role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss">
            {state.error}
          </p>
        )}

        <p className="eyebrow text-muted">Who won?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <WinButton value="a" team="Team 1" names={label(a)} tone="clay" disabled={pending || !ready} />
          <WinButton value="b" team="Team 2" names={label(b)} tone="court" disabled={pending || !ready} />
        </div>
        {!ready && <p className="text-xs text-muted">Pick at least one person on each team first.</p>}
      </div>
    </form>
  );
}

function WinButton({
  value,
  team,
  names,
  tone,
  disabled,
}: {
  value: "a" | "b";
  team: string;
  names: string;
  tone: "clay" | "court";
  disabled: boolean;
}) {
  return (
    <button
      name="win"
      value={value}
      disabled={disabled}
      className={`flex items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left text-white transition-[transform,opacity,box-shadow] active:translate-y-px disabled:opacity-30 ${
        tone === "clay"
          ? "bg-clay enabled:shadow-[0_14px_28px_-14px_rgb(217_102_26/0.9)]"
          : "bg-court enabled:shadow-[0_14px_28px_-14px_rgb(11_61_46/0.9)]"
      }`}
    >
      <span className="min-w-0">
        <span className="eyebrow block opacity-80">{team} won</span>
        <span className="display mt-1 block truncate text-xl leading-tight">{names}</span>
      </span>
      <Trophy />
    </button>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 shrink-0 opacity-90" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4" />
    </svg>
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
  const clay = tone === "clay";
  const on = clay ? "border-clay bg-clay text-white shadow-md" : "border-court bg-court text-white shadow-md";
  const full = ids.length >= MAX_TEAM;

  const toggle = (id: string) =>
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : full ? ids : [...ids, id]);

  return (
    <fieldset
      className={`space-y-3 border-y border-line p-5 sm:p-6 ${
        clay ? "bg-clay-soft/60 sm:border-r" : "bg-court-soft/70 max-sm:border-t-0"
      }`}
    >
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between">
        <span className={`eyebrow ${clay ? "text-clay-deep" : "text-court"}`}>{title}</span>
        <span className="nums text-xs text-muted">
          {ids.length}/{MAX_TEAM}
        </span>
      </div>
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
              className={`flex min-w-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-left text-sm font-semibold transition-all disabled:opacity-25 ${
                picked ? on : "border-line bg-surface hover:border-ink/30"
              }`}
            >
              <Avatar id={p.id} name={p.name} size={30} />
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
