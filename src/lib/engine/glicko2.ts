/**
 * Glicko-2 (Mark Glickman, 2013 spec) — the hidden MMR.
 *
 * Chosen over plain Elo because a friend-group ladder has two problems Elo
 * cannot express:
 *   1. New / returning players need to move fast, established ones slowly.
 *      That's rating deviation (RD).
 *   2. Isolated pods drift. When two pods finally meet, a high-RD player
 *      gets corrected hard and correctly.
 *
 * Ratings update once per *rating period* (we use one club week), batching all
 * of that week's matches — this is how Glicko-2 is meant to be run.
 */

export interface Glicko {
  /** Display scale (1500-centred), same units as Elo. */
  rating: number;
  /** Rating deviation on the display scale. 350 = brand new, ~50 = well known. */
  rd: number;
  /** Volatility — how erratic the player's results are. */
  vol: number;
}

export interface GlickoResult {
  opponent: Glicko;
  /** 1 = win, 0 = loss, 0.5 = draw (unused in tennis). */
  score: number;
}

const SCALE = 173.7178;

export const DEFAULT_GLICKO: Glicko = { rating: 1500, rd: 350, vol: 0.06 };

/** System constant. Smaller = volatility changes more slowly. 0.3–1.2 typical. */
export const TAU = 0.5;

/** RD is capped so nobody becomes unrateable after a long layoff. */
export const MAX_RD = 350;
/** RD floor stops established players from freezing solid. */
export const MIN_RD = 40;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));

const expectedScore = (mu: number, muJ: number, phiJ: number) =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/**
 * Run one rating period for a single player.
 * Pass an empty `results` array for a player who did not play that week —
 * their RD widens (uncertainty grows), but their rating is untouched.
 */
export function glicko2Update(player: Glicko, results: GlickoResult[], tau = TAU): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.vol;

  if (results.length === 0) {
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return {
      rating: player.rating,
      rd: clampRd(phiStar * SCALE),
      vol: sigma,
    };
  }

  // Step 3: estimated variance.
  let vInv = 0;
  for (const r of results) {
    const muJ = (r.opponent.rating - 1500) / SCALE;
    const phiJ = r.opponent.rd / SCALE;
    const gPhiJ = g(phiJ);
    const e = expectedScore(mu, muJ, phiJ);
    vInv += gPhiJ * gPhiJ * e * (1 - e);
  }
  const v = 1 / vInv;

  // Step 4: estimated improvement.
  let deltaSum = 0;
  for (const r of results) {
    const muJ = (r.opponent.rating - 1500) / SCALE;
    const phiJ = r.opponent.rd / SCALE;
    deltaSum += g(phiJ) * (r.score - expectedScore(mu, muJ, phiJ));
  }
  const delta = v * deltaSum;

  // Step 5: new volatility, via Illinois-algorithm root finding.
  const sigmaPrime = solveVolatility(phi, v, delta, sigma, tau);

  // Step 6-7: new RD and rating.
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * deltaSum;

  return {
    rating: muPrime * SCALE + 1500,
    rd: clampRd(phiPrime * SCALE),
    vol: sigmaPrime,
  };
}

function clampRd(rd: number): number {
  return Math.min(MAX_RD, Math.max(MIN_RD, rd));
}

function solveVolatility(
  phi: number,
  v: number,
  delta: number,
  sigma: number,
  tau: number,
): number {
  const a = Math.log(sigma * sigma);
  const eps = 1e-6;

  const f = (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };

  let A = a;
  let B: number;

  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);
  let guard = 0;

  while (Math.abs(B - A) > eps && guard++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/**
 * Probability that `a` beats `b`, accounting for both players' uncertainty.
 * Used for the RP upset bonus and for pre-match "win chance" in the UI.
 */
export function winProbability(a: Glicko, b: Glicko): number {
  const mu = (a.rating - 1500) / SCALE;
  const muJ = (b.rating - 1500) / SCALE;
  const combinedPhi = Math.sqrt((a.rd * a.rd + b.rd * b.rd)) / SCALE;
  return expectedScore(mu, muJ, combinedPhi);
}
