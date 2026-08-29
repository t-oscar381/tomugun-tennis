"use client";

import { useActionState, useMemo, useState } from "react";
import { BRACKET_SIZES } from "@/lib/engine/bracket";
import { createTournamentAction } from "@/app/actions";

interface Person {
  id: string;
  name: string;
  emoji: string;
  rp: number;
}

type Mode = "solo" | "pairs-random" | "pairs-manual";

/**
 * Building the field.
 *
 * Three ways in, because a group plays all three: singles, partners you chose,
 * or partners the app drew for you. The entrant list is assembled here and
 * re-validated server-side — the client knowing who is ticked is convenience,
 * not authority.
 */
export function NewTournament({ players, meId }: { players: Person[]; meId: string }) {
  const [state, action, pending] = useActionState(createTournamentAction, {});
  const [mode, setMode] = useState<Mode>("solo");
  const [seeded, setSeeded] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pairs, setPairs] = useState<string[][]>([]);
  const [holding, setHolding] = useState<string | null>(null);
  const [shuffleKey, setShuffleKey] = useState(0);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const name = (id: string) => byId.get(id)?.name ?? "?";

  const chosen = players.filter((p) => picked.has(p.id));

  // Seed strongest-first so a seeded draw actually means something.
  const entrants = useMemo(() => {
    if (mode === "solo") {
      return [...chosen]
        .sort((a, b) => b.rp - a.rp)
        .map((p, i) => ({ id: p.id, name: p.name, members: [p.id], seed: i + 1 }));
    }

    const teams =
      mode === "pairs-manual"
        ? pairs
        : chunkRandomly(chosen.map((p) => p.id), shuffleKey);

    return teams
      .map((members) => ({
        members,
        rp: members.reduce((n, m) => n + (byId.get(m)?.rp ?? 0), 0),
      }))
      .sort((a, b) => b.rp - a.rp)
      .map((t, i) => ({
        id: t.members.join("-"),
        name: t.members.map(name).join(" & "),
        members: t.members,
        seed: i + 1,
      }));
  }, [mode, chosen, pairs, shuffleKey, byId]);

  const kind = mode === "solo" ? "solo" : "pair";
  const enough = entrants.length >= 2;

  const toggle = (id: string) => {
    if (mode === "pairs-manual") {
      // In manual mode a tap is "pair this person with the last one I tapped".
      if (pairs.some((t) => t.includes(id))) {
        setPairs((prev) => prev.filter((t) => !t.includes(id)));
        return;
      }
      if (holding === id) return setHolding(null);
      if (holding) {
        setPairs((prev) => [...prev, [holding, id]]);
        setHolding(null);
      } else {
        setHolding(id);
      }
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const inTeam = (id: string) => pairs.some((t) => t.includes(id));

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <input type="hidden" name="meId" value={meId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="seeded" value={seeded ? "seeded" : "random"} />
      <input type="hidden" name="entrants" value={JSON.stringify(entrants)} />

      <div>
        <h2 className="text-lg font-bold">New tournament</h2>
        <p className="text-sm text-[var(--color-muted)]">
          {BRACKET_SIZES.join(", ")} or any number in between — odd fields get byes for the top
          seeds.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Name</span>
        <input
          name="name"
          maxLength={60}
          placeholder="Saturday King of the Court"
          className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5 outline-none focus:border-[var(--color-clay)]"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Format</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["solo", "Singles", "One player a side"],
              ["pairs-manual", "Pairs you pick", "Tap two to team up"],
              ["pairs-random", "Random pairs", "The app draws teams"],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setPairs([]);
                setHolding(null);
              }}
              className={`rounded-xl border p-3 text-left ${
                mode === value
                  ? "border-[var(--color-clay)] bg-[var(--color-clay-soft)]"
                  : "border-[var(--color-line)]"
              }`}
            >
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          {mode === "pairs-manual" ? "Tap two players to make a team" : "Who's in?"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const on = mode === "pairs-manual" ? inTeam(p.id) || holding === p.id : picked.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition-colors ${
                  holding === p.id
                    ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white ring-2 ring-[var(--color-clay)]/40"
                    : on
                      ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white"
                      : "border-[var(--color-line)] text-[var(--color-muted)]"
                }`}
              >
                <span aria-hidden>{p.emoji}</span>
                {p.name}
                {p.id === meId && <span className="text-[10px] font-bold uppercase">you</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      {mode === "pairs-random" && chosen.length >= 4 && (
        <button
          type="button"
          onClick={() => setShuffleKey((k) => k + 1)}
          className="rounded-lg border border-[var(--color-line)] px-4 py-2 text-sm font-semibold"
        >
          Redraw the teams
        </button>
      )}

      {entrants.length > 0 && (
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            The field · {entrants.length} {kind === "pair" ? "pairs" : "players"}
          </p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {entrants.map((e) => (
              <li key={e.id} className="nums text-sm">
                <span className="mr-2 text-[var(--color-muted)]">{e.seed}.</span>
                {e.name}
              </li>
            ))}
          </ol>
        </div>
      )}

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-sm font-semibold">Draw</legend>
        {(
          [
            [true, "Seeded by rank", "Best players kept apart until late"],
            [false, "Random draw", "Names out of a hat"],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={label}
            type="button"
            aria-pressed={seeded === value}
            onClick={() => setSeeded(value)}
            className={`flex-1 rounded-xl border p-3 text-left ${
              seeded === value
                ? "border-[var(--color-clay)] bg-[var(--color-clay-soft)]"
                : "border-[var(--color-line)]"
            }`}
          >
            <span className="block text-sm font-semibold">{label}</span>
            <span className="block text-xs text-[var(--color-muted)]">{hint}</span>
          </button>
        ))}
      </fieldset>

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending || !enough}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-3.5 font-bold text-white disabled:opacity-40"
      >
        {pending ? "Drawing…" : enough ? "Make the draw" : "Pick at least two sides"}
      </button>
    </form>
  );
}

/** Deterministic-per-key shuffle, then cut into pairs. Odd one out is dropped. */
function chunkRandomly(ids: string[], key: number): string[][] {
  let a = (key + 1) * 2654435761;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const out: string[][] = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) out.push([shuffled[i]!, shuffled[i + 1]!]);
  return out;
}
