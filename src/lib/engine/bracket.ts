/**
 * Single-elimination tournament brackets.
 *
 * The running ladder answers "who is best over months". A bracket answers a
 * different question — "who is king tonight" — and needs its own structure:
 * a fixed field, a draw, and a single winner at the end.
 *
 * An entrant is one *side*, not one person, so the same code runs a 16-player
 * singles draw and a 16-pair doubles draw without knowing the difference.
 */

export type EntrantKind = "solo" | "pair";

export interface Entrant {
  id: string;
  /** What appears in the bracket: "Andre", or "Andre & Bimo". */
  name: string;
  /** Player ids making up this side. One for solo, two for a pair. */
  members: string[];
  /** 1 is the top seed. */
  seed: number;
}

export interface BracketMatch {
  round: number;
  /** Position within the round, 0-based, top to bottom. */
  index: number;
  a: string | null;
  b: string | null;
  winnerId: string | null;
  /** True when one side had no opponent and advanced without playing. */
  bye: boolean;
}

export interface Bracket {
  /** Power of two the draw was padded to. */
  size: number;
  entrants: Entrant[];
  /** rounds[0] is the first round; the last round holds the single final. */
  rounds: BracketMatch[][];
}

export const BRACKET_SIZES = [4, 8, 16, 32] as const;

/** Round names counting back from the final, which is how people say them. */
export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semi-finals";
  if (fromEnd === 3) return "Quarter-finals";
  return `Round of ${2 ** fromEnd}`;
}

/**
 * Standard tournament seed order.
 *
 * Built by reflection: a bracket of 2n is the bracket of n with each slot
 * followed by its mirror (2n+1−slot). That is what guarantees seeds 1 and 2
 * can only meet in the final, 1 and 4 only in the semis, and so on — the
 * property that makes a seeded draw fair rather than merely shuffled.
 */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s, n + 1 - s);
    }
    order = next;
  }
  return order;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BuildOptions {
  /** Seed by ladder strength (true) or draw names out of a hat (false). */
  seeded?: boolean;
  seed?: number;
}

/**
 * Build a bracket from a field of any size.
 *
 * Fields are padded up to the next power of two with byes, and byes go to the
 * top seeds — the convention, and the only one that doesn't punish the best
 * players for an awkward turnout.
 */
export function buildBracket(entrants: Entrant[], opts: BuildOptions = {}): Bracket | null {
  if (entrants.length < 2) return null;

  const field = opts.seeded === false ? shuffleField(entrants, opts.seed ?? 1) : [...entrants];
  field.sort((a, b) => a.seed - b.seed);

  let size = 2;
  while (size < field.length) size *= 2;

  const bySeed = new Map(field.map((e) => [e.seed, e]));
  const order = seedOrder(size);

  const first: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = bySeed.get(order[i]!) ?? null;
    const b = bySeed.get(order[i + 1]!) ?? null;
    const isBye = (a === null) !== (b === null);
    first.push({
      round: 0,
      index: i / 2,
      a: a?.id ?? null,
      b: b?.id ?? null,
      // A side with no opponent is through without playing.
      winnerId: isBye ? (a?.id ?? b?.id ?? null) : null,
      bye: isBye,
    });
  }

  const totalRounds = Math.log2(size);
  const rounds: BracketMatch[][] = [first];
  for (let r = 1; r < totalRounds; r++) {
    const count = size / 2 ** (r + 1);
    rounds.push(
      Array.from({ length: count }, (_, index) => ({
        round: r,
        index,
        a: null,
        b: null,
        winnerId: null,
        bye: false,
      })),
    );
  }

  const bracket: Bracket = { size, entrants: field, rounds };
  // Byes are already decided, so push them forward immediately — otherwise
  // round two opens with empty slots nobody can fill.
  propagate(bracket);
  return bracket;
}

function shuffleField(entrants: Entrant[], seed: number): Entrant[] {
  const rand = mulberry32(seed);
  const out = [...entrants];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // A random draw is still a bracket: reassign seeds so the structure holds.
  return out.map((e, i) => ({ ...e, seed: i + 1 }));
}

/**
 * Push every decided result into the next round.
 *
 * Rerun from scratch after any change rather than patching one slot, so an
 * edited result can never leave a stale winner stranded downstream.
 */
export function propagate(bracket: Bracket): Bracket {
  for (let r = 1; r < bracket.rounds.length; r++) {
    for (const m of bracket.rounds[r]!) {
      m.a = null;
      m.b = null;
    }
  }

  for (let r = 0; r < bracket.rounds.length - 1; r++) {
    for (const m of bracket.rounds[r]!) {
      if (!m.winnerId) continue;
      const next = bracket.rounds[r + 1]![Math.floor(m.index / 2)]!;
      if (m.index % 2 === 0) next.a = m.winnerId;
      else next.b = m.winnerId;
    }

    // There is deliberately no bye handling beyond this point. Byes exist only
    // in round 0: the draw is padded to the SMALLEST power of two at or above
    // the field size, so every first-round match always holds at least the
    // higher seed and no later slot can be structurally empty.
    //
    // An earlier version tried to advance anyone left alone in a later round,
    // which confused "no result entered yet" with "no opponent possible" and
    // walked a quarter-finalist straight to the title in a full 16 draw.
  }
  return bracket;
}

/** Record a result. Downstream rounds are recomputed, not patched. */
export function setWinner(
  bracket: Bracket,
  round: number,
  index: number,
  winnerId: string | null,
): Bracket {
  const match = bracket.rounds[round]?.[index];
  if (!match) return bracket;
  if (winnerId !== null && winnerId !== match.a && winnerId !== match.b) return bracket;

  const next: Bracket = {
    ...bracket,
    rounds: bracket.rounds.map((r) => r.map((m) => ({ ...m }))),
  };
  next.rounds[round]![index]!.winnerId = winnerId;

  // Clearing a result must also clear everything it decided downstream.
  for (let r = round + 1; r < next.rounds.length; r++) {
    for (const m of next.rounds[r]!) {
      if (!m.bye) m.winnerId = null;
    }
  }
  return propagate(next);
}

/** The champion, once the final is decided. */
export function champion(bracket: Bracket): Entrant | null {
  const final = bracket.rounds[bracket.rounds.length - 1]?.[0];
  if (!final?.winnerId) return null;
  return bracket.entrants.find((e) => e.id === final.winnerId) ?? null;
}

export function entrantById(bracket: Bracket, id: string | null): Entrant | null {
  if (!id) return null;
  return bracket.entrants.find((e) => e.id === id) ?? null;
}

/** How far along the draw is, for a progress line. */
export function progress(bracket: Bracket): { played: number; total: number } {
  const all = bracket.rounds.flat().filter((m) => !m.bye);
  return { played: all.filter((m) => m.winnerId).length, total: all.length };
}
