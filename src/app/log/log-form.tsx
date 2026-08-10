"use client";

import { useActionState, useState } from "react";
import { logMatchAction } from "../actions";

interface Opponent {
  id: string;
  name: string;
  emoji: string;
  winChance: number;
}

/**
 * The whole point of this screen is speed: opponent, won/lost, score, done.
 * Everything is one tap except the scoreline itself, which gets a numeric
 * keypad hint but stays free text — set scores are faster to type than to
 * assemble from steppers, and the parser rejects anything illegal anyway.
 */
export function LogForm({
  meId,
  opponents,
  placeholder,
}: {
  meId: string;
  opponents: Opponent[];
  placeholder: string;
}) {
  const [state, action, pending] = useActionState(logMatchAction, {});
  const [opponentId, setOpponentId] = useState("");
  const [outcome, setOutcome] = useState<"won" | "lost">("won");

  const opponent = opponents.find((o) => o.id === opponentId);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="meId" value={meId} />
      <input type="hidden" name="opponentId" value={opponentId} />
      <input type="hidden" name="outcome" value={outcome} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Opponent</legend>
        <div className="grid grid-cols-2 gap-2">
          {opponents.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => setOpponentId(o.id)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                opponentId === o.id
                  ? "border-[var(--color-clay)] bg-[var(--color-clay)]/10"
                  : "border-[var(--color-line)] bg-[var(--color-surface)]"
              }`}
            >
              <span className="min-w-0 truncate">
                <span aria-hidden className="mr-1.5">
                  {o.emoji}
                </span>
                {o.name}
              </span>
              <span className="nums shrink-0 text-xs text-[var(--color-muted)]">
                {o.winChance}%
              </span>
            </button>
          ))}
        </div>
        {opponent && (
          <p className="nums text-xs text-[var(--color-muted)]">
            The ladder gives you a {opponent.winChance}% chance against {opponent.name}.
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Result</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["won", "lost"] as const).map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setOutcome(v)}
              className={`rounded-lg border px-3 py-3 font-semibold ${
                outcome === v
                  ? v === "won"
                    ? "border-[var(--color-win)] bg-[var(--color-win)]/15 text-[var(--color-win)]"
                    : "border-[var(--color-loss)] bg-[var(--color-loss)]/10 text-[var(--color-loss)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
              }`}
            >
              I {v}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Score — your games first</span>
        <input
          name="score"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          className="nums w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-lg tracking-wide outline-none focus:border-[var(--color-clay)]"
        />
        <span className="block text-xs text-[var(--color-muted)]">
          Tiebreak sets take the loser&apos;s points: <span className="nums">7-6(4)</span>. A
          deciding match tiebreak goes in brackets: <span className="nums">[10-8]</span>.
        </span>
      </label>

      {state.error && <p className="text-sm text-[var(--color-loss)]">{state.error}</p>}

      <button
        disabled={pending || !opponentId}
        className="w-full rounded-lg bg-[var(--color-clay)] px-4 py-3 font-bold text-[var(--color-bg)] disabled:opacity-40"
      >
        {pending ? "Saving…" : "Log it"}
      </button>
    </form>
  );
}
