/**
 * Point-level match simulation.
 *
 * Tennis is a nested best-of, which massively amplifies small per-point edges:
 * winning 55% of points wins ~95% of best-of-3 matches. So we simulate at the
 * point level and let the real scoring engine produce the scoreline — that's
 * the only way the margins (6-0 vs 7-6) come out believable.
 */

import { FORMATS, type MatchFormat, TennisMatch, type Side } from "../../src/lib/engine/tennis.js";
import { gaussian } from "./rng.js";

/** Probability the server wins a point between two equal players (club level). */
export const BASE_SERVE_WIN = 0.58;

/**
 * How much a skill gap moves the per-point probability.
 * Calibrated by `npm run calibrate` so the resulting *match* win rates track
 * the standard Elo curve. Do not hand-tune without re-running it.
 */
export const POINT_SENSITIVITY = 0.0632;

export interface SimPlayerSkill {
  /** Latent true skill on the Elo/Glicko display scale. The sim knows it; the app never does. */
  trueSkill: number;
  /** Day-to-day form swing, in rating points. High = streaky player. */
  consistency: number;
}

export function pointWinProbability(
  serverSkill: number,
  returnerSkill: number,
  baseServe = BASE_SERVE_WIN,
  sensitivity = POINT_SENSITIVITY,
): number {
  const raw = baseServe + sensitivity * ((serverSkill - returnerSkill) / 400);
  return Math.min(0.92, Math.max(0.15, raw));
}

export interface SimulatedMatch {
  match: TennisMatch;
  winner: Side;
  /** Effective skill each side actually played at on the day. */
  formA: number;
  formB: number;
}

export function simulateMatch(
  a: SimPlayerSkill,
  b: SimPlayerSkill,
  rand: () => number,
  format: MatchFormat = FORMATS.bestOf3,
  applyForm = true,
): SimulatedMatch {
  const formA = applyForm ? gaussian(rand, a.trueSkill, a.consistency) : a.trueSkill;
  const formB = applyForm ? gaussian(rand, b.trueSkill, b.consistency) : b.trueSkill;

  const firstServer: Side = rand() < 0.5 ? "A" : "B";
  const match = new TennisMatch(format, firstServer);

  const pAServing = pointWinProbability(formA, formB);
  const pBServing = pointWinProbability(formB, formA);

  let guard = 0;
  while (!match.isOver) {
    if (guard++ > 20000) throw new Error("match failed to terminate");
    const serverWins = match.server === "A" ? rand() < pAServing : rand() < pBServing;
    const winner: Side = serverWins ? match.server : match.server === "A" ? "B" : "A";
    match.playPoint(winner);
  }

  return { match, winner: match.winner!, formA, formB };
}

/** Monte-Carlo the match win rate for a given skill gap. Used by the calibrator. */
export function matchWinRate(
  skillGap: number,
  runs: number,
  rand: () => number,
  format: MatchFormat = FORMATS.bestOf3,
  sensitivity = POINT_SENSITIVITY,
): number {
  const a: SimPlayerSkill = { trueSkill: 1500 + skillGap, consistency: 0 };
  const b: SimPlayerSkill = { trueSkill: 1500, consistency: 0 };

  const pA = pointWinProbability(a.trueSkill, b.trueSkill, BASE_SERVE_WIN, sensitivity);
  const pB = pointWinProbability(b.trueSkill, a.trueSkill, BASE_SERVE_WIN, sensitivity);

  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const m = new TennisMatch(format, rand() < 0.5 ? "A" : "B");
    while (!m.isOver) {
      const serverWins = m.server === "A" ? rand() < pA : rand() < pB;
      const w: Side = serverWins ? m.server : m.server === "A" ? "B" : "A";
      m.playPoint(w);
    }
    if (m.winner === "A") wins++;
  }
  return wins / runs;
}

/** Standard Elo expectation — the target curve we calibrate against. */
export function eloExpectation(gap: number): number {
  return 1 / (1 + Math.pow(10, -gap / 400));
}
