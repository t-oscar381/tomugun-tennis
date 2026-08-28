/**
 * Randomised rotation scheduling — the "Americano" format borrowed from
 * pickleball social nights.
 *
 * Everyone turns up, the app shuffles who plays with and against whom every
 * round, and the point is that you end the evening having played *with* most
 * of the group rather than the same partner for two hours.
 *
 * Doing that well is not the same as shuffling. A naive random draw pairs the
 * same two people three times in five rounds and leaves someone sitting out
 * twice while another never rests. So this optimises explicitly for:
 *
 *   1. Nobody plays twice in a round.
 *   2. Court time is level — the gap between the busiest and least busy
 *      player stays within one match.
 *   3. Rest is shared out, worst-rested first.
 *   4. Repeat partners cost more than repeat opponents. Playing against the
 *      same person again is fine; playing *with* them again is the thing the
 *      format exists to avoid.
 *
 * It is a seeded greedy build with random restarts rather than an exact
 * solver: the schedules are small (a dozen players, a handful of rounds) and
 * "very good in 3ms" beats "optimal in 3s" for something regenerated on a tap.
 */

export type TeamSize = 1 | 2;

export interface RotationMatch {
  court: number;
  teamA: string[];
  teamB: string[];
}

export interface RotationRound {
  round: number;
  matches: RotationMatch[];
  /** Players sitting this one out, because the numbers didn't divide. */
  resting: string[];
}

export interface RotationSchedule {
  rounds: RotationRound[];
  /** Matches played per player id. */
  played: Record<string, number>;
  /** Rounds sat out per player id. */
  rested: Record<string, number>;
  /** How often each pair were team-mates. Empty when teamSize is 1. */
  repeatPartners: number;
  /** How often each pair faced each other more than once. */
  repeatOpponents: number;
}

export interface RotationOptions {
  playerIds: string[];
  rounds: number;
  courts: number;
  teamSize: TeamSize;
  seed?: number;
}

/** Minimum bodies needed before a rotation makes any sense. */
export function minimumPlayers(teamSize: TeamSize): number {
  return teamSize * 2;
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

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

interface Counters {
  played: Map<string, number>;
  rested: Map<string, number>;
  partner: Map<string, number>;
  opponent: Map<string, number>;
}

const bump = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const get = (m: Map<string, number>, k: string) => m.get(k) ?? 0;

/**
 * Build one schedule greedily. Returns null when the inputs can't produce a
 * single match, so the caller can say so rather than render an empty grid.
 */
function buildOnce(opts: Required<RotationOptions>, rand: () => number): RotationSchedule | null {
  const { playerIds, rounds, courts, teamSize } = opts;
  const perMatch = teamSize * 2;
  if (playerIds.length < perMatch || rounds < 1 || courts < 1) return null;

  const c: Counters = { played: new Map(), rested: new Map(), partner: new Map(), opponent: new Map() };
  for (const p of playerIds) {
    c.played.set(p, 0);
    c.rested.set(p, 0);
  }

  const out: RotationRound[] = [];

  for (let r = 1; r <= rounds; r++) {
    // Who sits: busiest first, and among equals whoever has rested least
    // recently gets priority to play. The random tiebreak stops the same
    // person always losing the coin flip.
    const order = [...playerIds].sort((a, b) => {
      const byPlayed = get(c.played, a) - get(c.played, b);
      if (byPlayed !== 0) return byPlayed;
      const byRested = get(c.rested, b) - get(c.rested, a);
      if (byRested !== 0) return byRested;
      return rand() - 0.5;
    });

    const seats = Math.min(courts * perMatch, Math.floor(playerIds.length / perMatch) * perMatch);
    const playing = order.slice(0, seats);
    const resting = order.slice(seats);
    for (const p of resting) bump(c.rested, p);

    const pool = [...playing];
    const matches: RotationMatch[] = [];

    for (let court = 1; pool.length >= perMatch; court++) {
      // Anchor on whoever has played least, so the schedule self-levels.
      pool.sort((a, b) => get(c.played, a) - get(c.played, b) || rand() - 0.5);
      const anchor = pool.shift()!;

      const teamA = [anchor];
      if (teamSize === 2) {
        const mate = pickBest(pool, (x) => get(c.partner, pairKey(anchor, x)) * 10 + rand());
        teamA.push(mate);
        pool.splice(pool.indexOf(mate), 1);
      }

      const teamB: string[] = [];
      for (let i = 0; i < teamSize; i++) {
        const pick = pickBest(pool, (x) => {
          // Facing someone again is a mild cost; partnering the player already
          // placed opposite is a real one.
          const vs = teamA.reduce((n, a) => n + get(c.opponent, pairKey(a, x)), 0);
          const withMate = teamB.reduce((n, b) => n + get(c.partner, pairKey(b, x)), 0);
          return vs * 3 + withMate * 10 + rand();
        });
        teamB.push(pick);
        pool.splice(pool.indexOf(pick), 1);
      }

      for (const p of [...teamA, ...teamB]) bump(c.played, p);
      if (teamSize === 2) {
        bump(c.partner, pairKey(teamA[0]!, teamA[1]!));
        bump(c.partner, pairKey(teamB[0]!, teamB[1]!));
      }
      for (const a of teamA) for (const b of teamB) bump(c.opponent, pairKey(a, b));

      matches.push({ court, teamA, teamB });
    }

    out.push({ round: r, matches, resting });
  }

  return summarise(out, c, playerIds);
}

function pickBest(pool: string[], cost: (x: string) => number): string {
  let best = pool[0]!;
  let bestCost = Infinity;
  for (const x of pool) {
    const v = cost(x);
    if (v < bestCost) {
      bestCost = v;
      best = x;
    }
  }
  return best;
}

function summarise(rounds: RotationRound[], c: Counters, playerIds: string[]): RotationSchedule {
  const played: Record<string, number> = {};
  const rested: Record<string, number> = {};
  for (const p of playerIds) {
    played[p] = get(c.played, p);
    rested[p] = get(c.rested, p);
  }
  const excess = (m: Map<string, number>) =>
    [...m.values()].reduce((n, v) => n + Math.max(0, v - 1), 0);

  return {
    rounds,
    played,
    rested,
    repeatPartners: excess(c.partner),
    repeatOpponents: excess(c.opponent),
  };
}

/** Lower is better: repeat partners dominate, then repeat opponents, then unfairness. */
function score(s: RotationSchedule): number {
  const counts = Object.values(s.played);
  const spread = Math.max(...counts) - Math.min(...counts);
  return s.repeatPartners * 100 + s.repeatOpponents * 10 + spread * 50;
}

/**
 * Generate a rotation. Deterministic for a given seed, so regenerating with
 * the same inputs shows the same schedule — and tapping "shuffle" with a new
 * seed genuinely reshuffles.
 */
export function generateRotation(opts: RotationOptions): RotationSchedule | null {
  const full: Required<RotationOptions> = { seed: 1, ...opts };
  const rand = mulberry32(full.seed);

  let best: RotationSchedule | null = null;
  // Restarts are cheap at this size and buy a noticeably better spread than
  // a single greedy pass, which can paint itself into a corner on the last court.
  for (let attempt = 0; attempt < 120; attempt++) {
    const candidate = buildOnce(full, rand);
    if (!candidate) return null;
    if (!best || score(candidate) < score(best)) best = candidate;
  }
  return best;
}
