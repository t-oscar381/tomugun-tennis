"use client";

import { useActionState, useCallback, useState } from "react";
import type { MatchFormat } from "@/lib/engine/tennis";
import { logMatchAction } from "../actions";
import { ScorePicker } from "./score-picker";

interface Opponent {
  id: string;
  name: string;
  emoji: string;
  winChance: number;
}

/**
 * Two questions, both answered by tapping: who, and what was the score.
 *
 * There used to be a third — "did you win?" — which the server then had to
 * reconcile against the typed score. Deriving the winner from the score
 * removes the contradiction rather than validating it.
 */
export function LogForm({
  meId,
  opponents,
  format,
}: {
  meId: string;
  opponents: Opponent[];
  format: MatchFormat;
}) {
  const [state, action, pending] = useActionState(logMatchAction, {});
  const [opponentId, setOpponentId] = useState("");
  const [scoreOk, setScoreOk] = useState(false);

  // Stable identity, or the picker's effect refires on every render.
  const handleValidity = useCallback((ok: boolean) => setScoreOk(ok), []);

  const opponent = opponents.find((o) => o.id === opponentId);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <input type="hidden" name="meId" value={meId} />
      <input type="hidden" name="opponentId" value={opponentId} />

      <fieldset className="lg:col-span-1">
        <legend className="mb-2 font-semibold">1. Who did you play?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          {opponents.map((o) => {
            const picked = opponentId === o.id;
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => setOpponentId(o.id)}
                aria-pressed={picked}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                  picked
                    ? "border-[var(--color-clay)] bg-[var(--color-clay)]/12"
                    : "border-[var(--color-line)] bg-[var(--color-surface)]"
                }`}
              >
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)] text-lg"
                >
                  {o.emoji}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{o.name}</span>
                  <span className="nums block text-xs text-[var(--color-muted)]">
                    {o.winChance}% your odds
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="lg:col-span-1">
        <legend className="mb-2 font-semibold">2. What was the score?</legend>
        <ScorePicker
          format={format}
          opponentName={opponent?.name ?? "Opponent"}
          disabled={!opponentId}
          onValidityChange={handleValidity}
        />
      </fieldset>

      {state.error && (
        <p className="lg:col-span-2 rounded-lg border border-[var(--color-loss)]/40 bg-[var(--color-loss)]/10 px-3 py-2 text-sm text-[var(--color-loss)]">
          {state.error}
        </p>
      )}

      <button
        disabled={pending || !opponentId || !scoreOk}
        className="w-full rounded-xl bg-[var(--color-clay)] px-4 py-4 text-lg font-bold text-white disabled:opacity-40 lg:col-span-2"
      >
        {pending
          ? "Saving…"
          : !opponentId
            ? "Pick an opponent first"
            : scoreOk
              ? "Log it"
              : "Finish the score"}
      </button>

      <p className="text-center text-xs text-[var(--color-muted)] lg:col-span-2">
        {opponent
          ? `${opponent.name} has to confirm this before it counts.`
          : "Your opponent confirms it before it counts."}
      </p>
    </form>
  );
}
