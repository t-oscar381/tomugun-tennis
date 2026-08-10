"use client";

import { useEffect, useMemo, useState } from "react";
import { parseScoreline } from "@/lib/engine/scoreline";
import type { MatchFormat } from "@/lib/engine/tennis";

/**
 * Tap-only score entry.
 *
 * The previous version was a free-text box. Typing a scoreline on a phone,
 * standing next to a court, is the single most error-prone thing in the app:
 * it invites 6-5, transposed sets, and scores entered from the wrong side.
 *
 * Three deliberate choices here:
 *
 *  1. Steppers, not a keyboard. You cannot express an impossible number.
 *  2. The winner is *derived* from the score, never asked. The old form asked
 *     twice — "did you win?" and then the score — and then had to reject the
 *     answer when the two disagreed. Asking once removes that entire class of
 *     mistake.
 *  3. A live scoreboard preview. You see what you're about to submit in the
 *     same shape the ladder will show it, before you commit.
 *
 * Validation still runs through the shared parseScoreline, so the engine
 * stays the single source of truth for what a legal tennis score is.
 */

interface SetScore {
  you: number;
  them: number;
  /** Loser's points, only when the set finished 7-6. */
  tb?: number;
}

const blank = (): SetScore => ({ you: 0, them: 0 });

/** Assumed loser's points when a 7-6 set is entered but the stepper untouched. */
const DEFAULT_TB = 5;

function isTiebreakSet(s: SetScore, format: MatchFormat): boolean {
  return (
    format.tiebreakAt > 0 &&
    ((s.you === format.tiebreakAt + 1 && s.them === format.tiebreakAt) ||
      (s.them === format.tiebreakAt + 1 && s.you === format.tiebreakAt))
  );
}

export function ScorePicker({
  format,
  opponentName,
  disabled,
  onValidityChange,
}: {
  format: MatchFormat;
  opponentName: string;
  disabled?: boolean;
  /** Lets the form refuse to submit a score the parser has already rejected. */
  onValidityChange?: (ok: boolean) => void;
}) {
  const maxSets = format.setsToWin * 2 - 1;
  const [sets, setSets] = useState<SetScore[]>([blank(), blank()]);

  const update = (i: number, patch: Partial<SetScore>) =>
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  /** Index of the deciding set, which may be a match tiebreak. */
  const deciderIndex = maxSets - 1;
  const isMatchTiebreakSet = (i: number) => format.decidingSetIsMatchTiebreak && i === deciderIndex;

  // Only offer a deciding set once the earlier ones are actually split.
  const decided = useMemo(() => {
    let you = 0;
    let them = 0;
    for (let i = 0; i < Math.min(sets.length, deciderIndex); i++) {
      const s = sets[i]!;
      if (s.you === s.them) continue;
      if (s.you > s.them) you++;
      else them++;
    }
    return { you, them };
  }, [sets, deciderIndex]);

  const needsDecider = decided.you === decided.them && decided.you >= format.setsToWin - 1;
  const visibleSets = needsDecider ? maxSets : deciderIndex;

  // Keep the array long enough for what's on screen, without dropping entries
  // the player already filled in.
  if (sets.length < visibleSets) {
    setSets((prev) => [...prev, ...Array.from({ length: visibleSets - prev.length }, blank)]);
  }

  const scoreline = useMemo(
    () => buildScoreline(sets.slice(0, visibleSets), format, deciderIndex),
    [sets, visibleSets, format, deciderIndex],
  );

  const parsed = useMemo(() => parseScoreline(scoreline, format), [scoreline, format]);
  const touched = sets.some((s) => s.you > 0 || s.them > 0);

  useEffect(() => {
    onValidityChange?.(parsed.ok);
  }, [parsed.ok, onValidityChange]);

  return (
    <div className="space-y-4">
      <input type="hidden" name="score" value={scoreline} />

      {Array.from({ length: visibleSets }, (_, i) => {
        const s = sets[i] ?? blank();
        const matchTb = isMatchTiebreakSet(i);
        const cap = matchTb ? Math.max(format.matchTiebreakTo + 10, 20) : format.tiebreakAt + 1;
        const showTb = !matchTb && isTiebreakSet(s, format);

        return (
          <div
            key={i}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              {matchTb ? `Deciding tiebreak (to ${format.matchTiebreakTo})` : `Set ${i + 1}`}
            </p>

            <Row
              label="You"
              value={s.you}
              max={cap}
              disabled={disabled}
              onChange={(v) => update(i, { you: v })}
            />
            <Row
              label={opponentName}
              value={s.them}
              max={cap}
              disabled={disabled}
              onChange={(v) => update(i, { them: v })}
            />

            {showTb && (
              <div className="mt-3 border-t border-[var(--color-line)] pt-3">
                <Row
                  label="Tiebreak — loser's points"
                  value={s.tb ?? DEFAULT_TB}
                  max={25}
                  small
                  disabled={disabled}
                  onChange={(v) => update(i, { tb: v })}
                />
              </div>
            )}
          </div>
        );
      })}

      <Preview
        sets={sets.slice(0, visibleSets)}
        format={format}
        deciderIndex={deciderIndex}
        opponentName={opponentName}
        ok={parsed.ok}
        error={parsed.ok ? null : parsed.error}
        touched={touched}
      />
    </div>
  );
}

function Row({
  label,
  value,
  max,
  onChange,
  small,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span
        className={`min-w-0 flex-1 truncate ${
          small ? "text-xs text-[var(--color-muted)]" : "font-semibold"
        }`}
      >
        {label}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Step
          sign="−"
          ariaLabel={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        />
        <span
          className={`nums text-center font-bold tabular-nums ${
            small ? "w-8 text-lg" : "w-10 text-2xl"
          }`}
        >
          {value}
        </span>
        <Step
          sign="+"
          ariaLabel={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        />
      </div>
    </div>
  );
}

function Step({
  sign,
  onClick,
  disabled,
  ariaLabel,
}: {
  sign: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      // 44px: the smallest target that stays reliable with a thumb, outdoors.
      className="size-11 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] text-xl font-bold text-[var(--color-ink)] transition-colors active:bg-[var(--color-clay)] active:text-[var(--color-bg)] disabled:opacity-25"
    >
      {sign}
    </button>
  );
}

/** The scoreboard, in the same shape the ladder shows results. */
function Preview({
  sets,
  format,
  deciderIndex,
  opponentName,
  ok,
  error,
  touched,
}: {
  sets: SetScore[];
  format: MatchFormat;
  deciderIndex: number;
  opponentName: string;
  ok: boolean;
  error: string | null;
  touched: boolean;
}) {
  const youWon = ok && countSets(sets).you > countSets(sets).them;

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
      <table className="w-full">
        <tbody>
          {(
            [
              { name: "You", pick: (s: SetScore) => s.you, other: (s: SetScore) => s.them, win: youWon },
              {
                name: opponentName,
                pick: (s: SetScore) => s.them,
                other: (s: SetScore) => s.you,
                win: ok && !youWon,
              },
            ] as const
          ).map((side) => (
            <tr key={side.name}>
              <td className="py-1 pr-3">
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  {ok && side.win && <span aria-label="winner">🏆</span>}
                  {side.name}
                </span>
              </td>
              {sets.map((s, i) => {
                const mine = side.pick(s);
                const theirs = side.other(s);
                const lead = mine > theirs;
                const matchTb = format.decidingSetIsMatchTiebreak && i === deciderIndex;
                return (
                  <td key={i} className="w-11 py-1">
                    <span
                      className={`nums relative block rounded-lg py-1.5 text-center text-lg font-bold ${
                        lead
                          ? "bg-[var(--color-win)]/20 text-[var(--color-win)]"
                          : "bg-[var(--color-surface)] text-[var(--color-muted)]"
                      }`}
                    >
                      {mine}
                      {!matchTb && !lead && isTiebreakSet(s, format) && (
                        <sup className="ml-0.5 text-[10px] font-semibold">
                          {s.tb ?? DEFAULT_TB}
                        </sup>
                      )}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-3 text-sm">
        {!touched ? (
          <span className="text-[var(--color-muted)]">Tap + and − to build the score.</span>
        ) : ok ? (
          <span className="font-semibold text-[var(--color-win)]">
            {youWon ? "You win" : `${opponentName} wins`} — this is what gets logged.
          </span>
        ) : (
          <span className="text-[var(--color-loss)]">{error}</span>
        )}
      </p>
    </div>
  );
}

function countSets(sets: SetScore[]): { you: number; them: number } {
  let you = 0;
  let them = 0;
  for (const s of sets) {
    if (s.you === s.them) continue;
    if (s.you > s.them) you++;
    else them++;
  }
  return { you, them };
}

function buildScoreline(sets: SetScore[], format: MatchFormat, deciderIndex: number): string {
  return sets
    .map((s, i) => {
      if (format.decidingSetIsMatchTiebreak && i === deciderIndex) {
        return `[${s.you}-${s.them}]`;
      }
      return isTiebreakSet(s, format)
        ? `${s.you}-${s.them}(${s.tb ?? DEFAULT_TB})`
        : `${s.you}-${s.them}`;
    })
    .join(" ");
}
