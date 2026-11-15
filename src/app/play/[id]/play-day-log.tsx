"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import type { MatchFormat } from "@/lib/engine/tennis";
import { logPlayDayMatchAction } from "@/app/actions";
import { ScorePicker } from "@/app/log/score-picker";

interface Person {
  id: string;
  name: string;
  emoji: string;
}

/**
 * Log a match for two people who are here.
 *
 * It is built for the referee: nobody is "you". Pick the two players, tap the
 * games each won, done — and the form empties itself and stays put, so the next
 * result is the same three taps without navigating anywhere.
 */
export function PlayDayLog({
  sessionId,
  present,
  format,
}: {
  sessionId: string;
  present: Person[];
  format: MatchFormat;
}) {
  const [state, action, pending] = useActionState(logPlayDayMatchAction, {});
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [scoreOk, setScoreOk] = useState(false);
  // Bumping the key remounts the picker, which is the cleanest way to zero it.
  const [round, setRound] = useState(0);

  const handleValidity = useCallback((ok: boolean) => setScoreOk(ok), []);

  useEffect(() => {
    if (state.ok) {
      setA("");
      setB("");
      setScoreOk(false);
      setRound((r) => r + 1);
    }
  }, [state.stamp, state.ok]);

  const nameOf = (id: string) => present.find((p) => p.id === id)?.name;
  const ready = Boolean(a && b);

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="a" value={a} />
      <input type="hidden" name="b" value={b} />

      <div>
        <h2 className="text-lg font-bold tracking-tight">Log a match</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Pick the two who played. It goes straight into the record — anyone can remove it below if
          it&apos;s wrong.
        </p>
      </div>

      {state.ok && (
        <p className="rounded-lg border border-[var(--color-win)]/40 bg-[var(--color-win)]/10 px-3 py-2 text-sm font-semibold">
          Logged: {state.ok}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Side title="Player 1" value={a} other={b} present={present} onPick={setA} />
        <Side title="Player 2" value={b} other={a} present={present} onPick={setB} />
      </div>

      <ScorePicker
        key={round}
        format={format}
        youName={nameOf(a) ?? "Player 1"}
        opponentName={nameOf(b) ?? "Player 2"}
        disabled={!ready}
        onValidityChange={handleValidity}
      />

      {state.error && (
        <p className="rounded-lg border border-[var(--color-loss)]/40 bg-[var(--color-loss)]/10 px-3 py-2 text-sm text-[var(--color-loss)]">
          {state.error}
        </p>
      )}

      <button
        disabled={pending || !ready || !scoreOk}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-4 text-lg font-bold text-white disabled:opacity-40"
      >
        {pending ? "Saving…" : !ready ? "Pick both players" : scoreOk ? "Log it" : "Finish the score"}
      </button>
    </form>
  );
}

function Side({
  title,
  value,
  other,
  present,
  onPick,
}: {
  title: string;
  value: string;
  other: string;
  present: Person[];
  onPick: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        {present.map((p) => {
          const picked = value === p.id;
          // Already Player 1? Then they can't also be Player 2.
          const taken = other === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={taken}
              aria-pressed={picked}
              onClick={() => onPick(picked ? "" : p.id)}
              className={`truncate rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors disabled:opacity-30 ${
                picked
                  ? "border-[var(--color-clay)] bg-[var(--color-clay)] text-white"
                  : "border-[var(--color-line)] bg-[var(--color-bg)]"
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
