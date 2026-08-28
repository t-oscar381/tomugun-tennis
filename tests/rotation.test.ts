import { describe, expect, it } from "vitest";
import { generateRotation, type RotationSchedule } from "../src/lib/engine/rotation.js";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

const everyone = (s: RotationSchedule) => Object.keys(s.played);
const spread = (s: RotationSchedule) => {
  const v = Object.values(s.played);
  return Math.max(...v) - Math.min(...v);
};

describe("rotation scheduling", () => {
  it("never puts a player on two courts in the same round", () => {
    const s = generateRotation({ playerIds: players(12), rounds: 6, courts: 3, teamSize: 2, seed: 7 })!;
    for (const round of s.rounds) {
      const onCourt = round.matches.flatMap((m) => [...m.teamA, ...m.teamB]);
      expect(new Set(onCourt).size).toBe(onCourt.length);
      // Everyone is either playing or explicitly resting — nobody vanishes.
      expect(onCourt.length + round.resting.length).toBe(12);
    }
  });

  it("keeps court time level across the night", () => {
    const s = generateRotation({ playerIds: players(10), rounds: 8, courts: 2, teamSize: 2, seed: 3 })!;
    expect(spread(s)).toBeLessThanOrEqual(1);
  });

  it("avoids repeat partners while fresh pairings remain", () => {
    // 8 players, 2 courts, 3 rounds = 12 partnerships drawn from 28 possible.
    // There is no excuse for a repeat.
    const s = generateRotation({ playerIds: players(8), rounds: 3, courts: 2, teamSize: 2, seed: 11 })!;
    expect(s.repeatPartners).toBe(0);
  });

  it("shares out the byes rather than benching the same person", () => {
    // 6 players on one doubles court: two sit out every round.
    const s = generateRotation({ playerIds: players(6), rounds: 6, courts: 1, teamSize: 2, seed: 5 })!;
    const rests = Object.values(s.rested);
    expect(Math.max(...rests) - Math.min(...rests)).toBeLessThanOrEqual(1);
  });

  it("builds singles rotations too", () => {
    const s = generateRotation({ playerIds: players(8), rounds: 4, courts: 2, teamSize: 1, seed: 2 })!;
    for (const round of s.rounds) {
      for (const m of round.matches) {
        expect(m.teamA).toHaveLength(1);
        expect(m.teamB).toHaveLength(1);
      }
    }
    expect(s.repeatPartners).toBe(0); // no partners exist in singles
    expect(spread(s)).toBeLessThanOrEqual(1);
  });

  it("is deterministic for a seed, and different for another", () => {
    const opts = { playerIds: players(8), rounds: 4, courts: 2, teamSize: 2 as const };
    const a = JSON.stringify(generateRotation({ ...opts, seed: 42 })!.rounds);
    const b = JSON.stringify(generateRotation({ ...opts, seed: 42 })!.rounds);
    const c = JSON.stringify(generateRotation({ ...opts, seed: 43 })!.rounds);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("refuses inputs that cannot produce a match", () => {
    expect(generateRotation({ playerIds: players(3), rounds: 3, courts: 1, teamSize: 2 })).toBeNull();
    expect(generateRotation({ playerIds: players(8), rounds: 0, courts: 1, teamSize: 2 })).toBeNull();
  });

  it("caps courts to the bodies available", () => {
    // 5 players, 3 courts booked: only one doubles court can actually run.
    const s = generateRotation({ playerIds: players(5), rounds: 3, courts: 3, teamSize: 2, seed: 9 })!;
    for (const round of s.rounds) {
      expect(round.matches).toHaveLength(1);
      expect(round.resting).toHaveLength(1);
    }
    expect(everyone(s)).toHaveLength(5);
  });
});
