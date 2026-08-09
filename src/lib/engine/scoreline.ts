/**
 * Final-score entry: parse and validate a scoreline typed by a human.
 *
 * The simulator drives the scoring engine point by point, so illegal scores
 * are impossible there. Hand entry has no such guarantee — someone will type
 * "6-5" or "7-2" or claim a 4-set best-of-3. This is the gatekeeper for the
 * ~8-second logging path, and it is deliberately strict: a ladder is only
 * worth caring about if the results in it are real.
 */

import type { MatchFormat } from "./tennis";

export interface ParsedSet {
  a: number;
  b: number;
  /** Loser's points in the tiebreak, when the set was decided by one. */
  tiebreakLoserPoints?: number;
  /** True when this "set" is a deciding match tiebreak, e.g. [10-8]. */
  matchTiebreak?: boolean;
  /** Raw match-tiebreak points, kept so the scoreline can be rendered back. */
  tbA?: number;
  tbB?: number;
}

export interface ParsedScoreline {
  sets: ParsedSet[];
  setsA: number;
  setsB: number;
  gamesA: number;
  gamesB: number;
  /** "A" or "B" — which side the scoreline says won. */
  winner: "A" | "B";
}

export type ScoreResult =
  | { ok: true; value: ParsedScoreline }
  | { ok: false; error: string };

const SET_RE = /^(\d{1,2})-(\d{1,2})(?:\((\d{1,2})\))?$/;
const MATCH_TB_RE = /^\[(\d{1,2})-(\d{1,2})\]$/;

/**
 * Accepts "6-4 3-6 [10-8]", "7-6(5) 6-2", "6-4 6-4".
 * Always read from the perspective of side A.
 */
export function parseScoreline(input: string, format: MatchFormat): ScoreResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: "Enter a score." };

  const maxSets = format.setsToWin * 2 - 1;
  if (tokens.length > maxSets) {
    return { ok: false, error: `Too many sets — this format is best of ${maxSets}.` };
  }

  const sets: ParsedSet[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const isLast = i === tokens.length - 1;

    const mtb = MATCH_TB_RE.exec(token);
    if (mtb) {
      if (!format.decidingSetIsMatchTiebreak) {
        return { ok: false, error: "This format plays a full deciding set, not a match tiebreak." };
      }
      if (!isLast || i !== maxSets - 1) {
        return { ok: false, error: "A match tiebreak can only be the deciding set." };
      }
      const a = Number(mtb[1]);
      const b = Number(mtb[2]);
      const check = validateTiebreak(a, b, format.matchTiebreakTo);
      if (check) return { ok: false, error: check };
      sets.push({ a: a > b ? 1 : 0, b: b > a ? 1 : 0, matchTiebreak: true, tbA: a, tbB: b });
      continue;
    }

    const m = SET_RE.exec(token);
    if (!m) return { ok: false, error: `"${token}" isn't a set score. Use 6-4, 7-6(5) or [10-8].` };

    const a = Number(m[1]);
    const b = Number(m[2]);
    const tb = m[3] === undefined ? undefined : Number(m[3]);

    const err = validateSet(a, b, tb, format);
    if (err) return { ok: false, error: err };

    sets.push({ a, b, tiebreakLoserPoints: tb });
  }

  // Tally, and confirm the match actually finished when it says it did.
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;

  for (const s of sets) {
    if (s.matchTiebreak) {
      if (s.a > s.b) setsA++;
      else setsB++;
      continue;
    }
    gamesA += s.a;
    gamesB += s.b;
    if (s.a > s.b) setsA++;
    else setsB++;
  }

  if (setsA < format.setsToWin && setsB < format.setsToWin) {
    return { ok: false, error: `Match isn't finished — someone needs ${format.setsToWin} sets.` };
  }
  if (setsA >= format.setsToWin && setsB >= format.setsToWin) {
    return { ok: false, error: "Both players can't win the match." };
  }

  // No dead rubbers: play stops the moment someone reaches the target.
  const decidingIndex = sets.findIndex((_, i) => {
    let a = 0;
    let b = 0;
    for (let j = 0; j <= i; j++) {
      const s = sets[j]!;
      if (s.a > s.b) a++;
      else b++;
    }
    return a >= format.setsToWin || b >= format.setsToWin;
  });
  if (decidingIndex !== -1 && decidingIndex < sets.length - 1) {
    return { ok: false, error: "The match was already won before the last set." };
  }

  return {
    ok: true,
    value: { sets, setsA, setsB, gamesA, gamesB, winner: setsA > setsB ? "A" : "B" },
  };
}

function validateSet(
  a: number,
  b: number,
  tbLoserPoints: number | undefined,
  format: MatchFormat,
): string | null {
  const { gamesPerSet, tiebreakAt, tiebreakTo } = format;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);

  if (a === b) return `${a}-${b} isn't a finished set.`;

  const tiebreakScore = tiebreakAt > 0 && hi === tiebreakAt + 1 && lo === tiebreakAt;

  if (tbLoserPoints !== undefined && !tiebreakScore) {
    return `Only a ${tiebreakAt + 1}-${tiebreakAt} set has a tiebreak.`;
  }

  if (tiebreakScore) {
    if (tbLoserPoints !== undefined) {
      // Loser's points must be losing points: either <= to-2, or a long tiebreak
      // is expressed by the winner's margin, which we can't see here. Cap at
      // something sane rather than inventing a rule.
      if (tbLoserPoints > 50) return "Tiebreak score looks wrong.";
      if (tbLoserPoints > tiebreakTo - 2 && tbLoserPoints < tiebreakTo - 1) {
        return `A tiebreak to ${tiebreakTo} can't be lost ${tbLoserPoints}.`;
      }
    }
    return null;
  }

  if (hi < gamesPerSet) return `${a}-${b} is short — a set needs ${gamesPerSet} games.`;
  if (hi === gamesPerSet && hi - lo < 2) {
    return `${a}-${b} needs a two-game margin.`;
  }
  if (hi > gamesPerSet) {
    // Only 7-5 is legal above the target when a tiebreak exists at 6-6.
    const allowed = tiebreakAt > 0 ? gamesPerSet + 1 : Infinity;
    if (hi > allowed) return `${a}-${b} isn't possible with a tiebreak at ${tiebreakAt}-${tiebreakAt}.`;
    if (hi - lo !== 2) return `${a}-${b} needs a two-game margin.`;
  }

  return null;
}

function validateTiebreak(a: number, b: number, to: number): string | null {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < to) return `A match tiebreak goes to ${to}.`;
  if (hi - lo < 2) return "A tiebreak needs a two-point margin.";
  if (hi > to && hi - lo !== 2) return "A tiebreak stops as soon as someone leads by two.";
  return null;
}

/** Render parsed sets back to the canonical string, from A's perspective. */
export function formatScoreline(sets: ParsedSet[]): string {
  return sets
    .map((s) =>
      s.matchTiebreak
        ? `[${s.tbA ?? 0}-${s.tbB ?? 0}]`
        : s.tiebreakLoserPoints !== undefined
          ? `${s.a}-${s.b}(${s.tiebreakLoserPoints})`
          : `${s.a}-${s.b}`,
    )
    .join(" ");
}

/** Flip a scoreline to the other player's perspective. */
export function invertSets(sets: ParsedSet[]): ParsedSet[] {
  return sets.map((s) => ({ ...s, a: s.b, b: s.a, tbA: s.tbB, tbB: s.tbA }));
}
