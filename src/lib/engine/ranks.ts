/**
 * The visible ranked layer — "Apex, but simpler".
 *
 * Two numbers per player, deliberately separated:
 *   - MMR  (Glicko-2)  — honest, hidden, used for matchmaking + upset maths.
 *   - RP   (this file) — visible, only ever earned, gated by an entry cost.
 *
 * The entry cost is the whole trick. At low tiers it's trivial, so everyone
 * climbs and the ladder feels generous. At high tiers it's brutal, so holding
 * rank requires a real win rate. Equilibrium (net 0 RP) sits at:
 *
 *      winRate* = (entryCost - lossRP) / (winRP - lossRP)
 *
 * which we print in the simulator so the tuning is never guesswork.
 */

export const TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
  "Master",
] as const;

export type Tier = (typeof TIERS)[number];

/**
 * RP width of each tier. Master is open-ended.
 *
 * Sized so one 14-week season spans the whole ladder: the strongest player in
 * a group nets roughly 500-600 RP over ~22 matches, which should read as
 * "Bronze to Master", not "Bronze to Silver". Widen this if you run longer
 * seasons or more matches per night.
 */
export const TIER_WIDTH = 95;
/** Divisions inside a tier (IV -> I). Master has none. */
export const DIVISIONS = 4;

export const RP = {
  /**
   * Base RP for a win, paid regardless of who you beat.
   *
   * This is deliberately the larger half of the win payout. When the upset
   * bonus dominated, the group's best player could not climb: matchmaking gave
   * them a 90% win probability, so beating the field paid almost nothing and
   * they stalled two tiers below the top. A win must always feel like a win.
   */
  winBase: 45,
  /** Extra RP scaled by how unlikely the win was. Farming is handled separately by repeat decay. */
  winUpset: 30,
  /** Consolation RP for a loss, scaled by how unlikely a win would have been. */
  lossConsolation: 12,
  /** Max bonus RP for a dominant scoreline. */
  marginMax: 10,
  /** Matches before you get a rank at all. */
  placementMatches: 5,
} as const;

/**
 * The design input: what win rate each tier should demand just to hold station.
 *
 * This is the one table worth arguing about — everything else is derived.
 *
 * Two simulator findings shaped these numbers:
 *
 * 1. Bronze must not be free. An early version demanded 0%, and a player who
 *    won 32% of matches finished 5th of 8 purely by turning up. Volume beat
 *    skill and the leaderboard stopped being honest.
 *
 * 2. The top cannot demand what a small pool can't supply. Asking 80% for
 *    Master sounds appropriately brutal, but matchmaking always finds you a
 *    peer, so nobody in a group of 8 sustains it — Diamond and Master went
 *    unreached across 120 simulated seasons. These rates reflect what the
 *    strongest player in a small closed group actually sustains.
 */
export const TARGET_HOLD_WIN_RATE = [0.18, 0.27, 0.35, 0.43, 0.50, 0.58];

/**
 * RP you forfeit just to step on court, solved from the curve above.
 * Equilibrium is where expected gain equals expected loss:
 *     entry = lossRP(even) + rate * (winRP(even) - lossRP(even))
 */
export const ENTRY_COST = TARGET_HOLD_WIN_RATE.map((rate) => {
  const winRp = RP.winBase + RP.winUpset * 0.5;
  const lossRp = RP.lossConsolation * 0.5;
  return Math.round(lossRp + rate * (winRp - lossRp));
});

export interface RankInfo {
  tier: Tier;
  tierIndex: number;
  /** 4 (lowest) down to 1 (highest). Undefined in Master. */
  division?: number;
  rp: number;
  /** RP into the current tier. */
  progress: number;
  label: string;
}

export function rankFromRp(rp: number): RankInfo {
  const clamped = Math.max(0, rp);
  const rawIndex = Math.floor(clamped / TIER_WIDTH);
  const tierIndex = Math.min(TIERS.length - 1, rawIndex);
  const tier = TIERS[tierIndex]!;
  const isMaster = tierIndex === TIERS.length - 1;
  const progress = isMaster ? clamped - tierIndex * TIER_WIDTH : clamped % TIER_WIDTH;

  if (isMaster) {
    return { tier, tierIndex, rp: clamped, progress, label: `Master ${Math.round(clamped)}` };
  }

  const division = DIVISIONS - Math.floor(progress / (TIER_WIDTH / DIVISIONS));
  return {
    tier,
    tierIndex,
    division,
    rp: clamped,
    progress,
    label: `${tier} ${roman(division)}`,
  };
}

function roman(n: number): string {
  return ["", "I", "II", "III", "IV"][n] ?? String(n);
}

export interface RpOutcome {
  /** RP earned from the result itself, before the entry cost. */
  earned: number;
  /** Bonus for a dominant scoreline (winners only). */
  marginBonus: number;
  /** RP burned to play the match. */
  entryCost: number;
  /** Net movement — what the player actually sees. */
  delta: number;
  newRp: number;
}

export interface RpInput {
  currentRp: number;
  won: boolean;
  /** Pre-match win probability from MMR, 0..1. */
  winProbability: number;
  /** Games won by this player across the whole match. */
  gamesFor: number;
  gamesAgainst: number;
  /** Placement matches are free: no entry cost, no RP movement. */
  inPlacements?: boolean;
}

export function applyRp(input: RpInput): RpOutcome {
  const { currentRp, won, winProbability: e, gamesFor, gamesAgainst } = input;

  if (input.inPlacements) {
    return { earned: 0, marginBonus: 0, entryCost: 0, delta: 0, newRp: currentRp };
  }

  const tierIndex = rankFromRp(currentRp).tierIndex;
  const entryCost = ENTRY_COST[tierIndex] ?? ENTRY_COST[ENTRY_COST.length - 1]!;

  let earned: number;
  let marginBonus = 0;

  if (won) {
    earned = RP.winBase + RP.winUpset * (1 - e);
    const totalGames = gamesFor + gamesAgainst;
    const ratio = totalGames === 0 ? 0.5 : gamesFor / totalGames;
    marginBonus = clamp(Math.round(RP.marginMax * 2 * (ratio - 0.5)), 0, RP.marginMax);
  } else {
    // Losing to someone far better costs you almost nothing beyond entry.
    earned = RP.lossConsolation * (1 - e);
  }

  const delta = Math.round(earned + marginBonus - entryCost);
  const newRp = Math.max(0, currentRp + delta);

  return { earned: Math.round(earned), marginBonus, entryCost, delta, newRp };
}

/** Win rate needed to hold station at a given tier, for an even matchup. */
export function equilibriumWinRate(tierIndex: number): number {
  const entry = ENTRY_COST[tierIndex] ?? ENTRY_COST[ENTRY_COST.length - 1]!;
  const winRp = RP.winBase + RP.winUpset * 0.5;
  const lossRp = RP.lossConsolation * 0.5;
  const rate = (entry - lossRp) / (winRp - lossRp);
  return clamp(rate, 0, 1);
}

/**
 * Seed RP from MMR once placements are done, so nobody starts from zero —
 * but low enough that the climb is still the season's story.
 */
export function seedRpFromMmr(rating: number): number {
  return clamp(Math.round((rating - 1250) * 0.35), 0, Math.round(TIER_WIDTH * 1.5));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
