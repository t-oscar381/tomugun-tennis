import { describe, expect, it } from "vitest";
import { FORMATS, type MatchFormat } from "../src/lib/engine/tennis.js";
import { formatScoreline, invertSets, parseScoreline } from "../src/lib/engine/scoreline.js";

// Widened to MatchFormat: `satisfies` narrows each entry to its literal
// types, which would stop a helper from accepting both formats.
const F: MatchFormat = FORMATS.bestOf3MatchTB;
const FULL: MatchFormat = FORMATS.bestOf3;

const ok = (s: string, fmt: MatchFormat = F) => {
  const r = parseScoreline(s, fmt);
  if (!r.ok) throw new Error(`expected "${s}" to parse, got: ${r.error}`);
  return r.value;
};
const err = (s: string, fmt: MatchFormat = F) => {
  const r = parseScoreline(s, fmt);
  if (r.ok) throw new Error(`expected "${s}" to be rejected`);
  return r.error;
};

describe("accepts real scorelines", () => {
  it("straight sets", () => {
    const v = ok("6-4 6-3");
    expect(v.winner).toBe("A");
    expect(v.setsA).toBe(2);
    expect(v.gamesA).toBe(12);
    expect(v.gamesB).toBe(7);
  });

  it("7-5 and 7-6 with tiebreak points", () => {
    const v = ok("7-5 7-6(4)");
    expect(v.setsA).toBe(2);
    expect(v.sets[1]?.tiebreakLoserPoints).toBe(4);
  });

  it("a deciding match tiebreak", () => {
    const v = ok("6-4 3-6 [10-8]");
    expect(v.winner).toBe("A");
    expect(v.setsA).toBe(2);
    // The match tiebreak contributes no games to the margin signal.
    expect(v.gamesA).toBe(9);
    expect(v.gamesB).toBe(10);
  });

  it("the loser's scoreline", () => {
    const v = ok("4-6 3-6");
    expect(v.winner).toBe("B");
    expect(v.setsB).toBe(2);
  });

  it("a full third set when the format allows it", () => {
    const v = ok("6-4 3-6 7-5", FULL);
    expect(v.winner).toBe("A");
  });
});

describe("rejects impossible scorelines", () => {
  it("a set that never finished", () => {
    expect(err("6-5 6-3")).toMatch(/two-game margin/);
    expect(err("5-4 6-3")).toMatch(/short/);
  });

  it("a tied set", () => {
    expect(err("6-6 6-3")).toMatch(/finished set/);
  });

  it("8-6, which a tiebreak at 6-6 makes impossible", () => {
    expect(err("8-6 6-3")).toMatch(/isn't possible/);
  });

  it("tiebreak points on a non-tiebreak set", () => {
    expect(err("6-4(3) 6-3")).toMatch(/tiebreak/);
  });

  it("an unfinished match", () => {
    expect(err("6-4")).toMatch(/isn't finished/);
  });

  it("more sets than the format allows", () => {
    expect(err("6-4 3-6 6-4 6-4")).toMatch(/Too many sets/);
  });

  it("a dead rubber after the match was already won", () => {
    expect(err("6-4 6-4 6-4")).toMatch(/already won/);
  });

  it("a match tiebreak in a format that plays a full set", () => {
    expect(err("6-4 3-6 [10-8]", FULL)).toMatch(/full deciding set/);
  });

  it("a match tiebreak that isn't the decider", () => {
    expect(err("[10-8] 6-4")).toMatch(/deciding set/);
  });

  it("a match tiebreak without a two-point margin", () => {
    expect(err("6-4 3-6 [10-9]")).toMatch(/two-point margin/);
  });

  it("gibberish", () => {
    expect(err("banana")).toMatch(/isn't a set score/);
    expect(err("")).toMatch(/Enter a score/);
  });
});

describe("round-tripping", () => {
  it("formats back to the canonical string", () => {
    expect(formatScoreline(ok("6-4 7-6(5)").sets)).toBe("6-4 7-6(5)");
    expect(formatScoreline(ok("6-4 3-6 [10-8]").sets)).toBe("6-4 3-6 [10-8]");
  });

  it("inverts to the opponent's perspective", () => {
    const flipped = invertSets(ok("6-4 3-6 [10-8]").sets);
    expect(flipped[0]).toMatchObject({ a: 4, b: 6 });
    expect(flipped[2]).toMatchObject({ tbA: 8, tbB: 10 });
  });
});
