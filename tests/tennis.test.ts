import { describe, expect, it } from "vitest";
import { FORMATS, TennisMatch, type Side } from "../src/lib/engine/tennis.js";

/** Feed a match a fixed sequence of point winners. */
function play(m: TennisMatch, seq: string): TennisMatch {
  for (const ch of seq) m.playPoint(ch as Side);
  return m;
}

/** Walk a set to 6-6 by alternating game winners, so neither side ever leads by 2. */
function toSixAll(m: TennisMatch): TennisMatch {
  for (let g = 0; g < 12; g++) play(m, g % 2 === 0 ? "AAAA" : "BBBB");
  return m;
}

describe("game scoring", () => {
  it("labels points 15/30/40", () => {
    const m = new TennisMatch();
    expect(m.pointScore()).toBe("0-0");
    m.playPoint("A");
    expect(m.pointScore()).toBe("15-0");
    m.playPoint("B");
    expect(m.pointScore()).toBe("15-15");
    m.playPoint("A");
    m.playPoint("A");
    expect(m.pointScore()).toBe("40-15");
  });

  it("requires a two-point margin — 40-30 is not a game", () => {
    const m = play(new TennisMatch(FORMATS.singleSet, "A"), "AAAB");
    expect(m.gamesA).toBe(0);
    expect(m.pointScore()).toBe("40-15");
    m.playPoint("B");
    expect(m.gamesA).toBe(0);
    expect(m.pointScore()).toBe("40-30");
  });

  it("goes to deuce and advantage", () => {
    const m = play(new TennisMatch(FORMATS.singleSet, "A"), "AAABBB");
    expect(m.pointScore()).toBe("DEUCE");
    m.playPoint("A");
    expect(m.pointScore()).toBe("AD IN"); // A is serving
    m.playPoint("B");
    expect(m.pointScore()).toBe("DEUCE");
    m.playPoint("B");
    expect(m.pointScore()).toBe("AD OUT");
    m.playPoint("B");
    expect(m.gamesB).toBe(1);
  });

  it("no-ad ends the game on the deuce point", () => {
    const fmt = { ...FORMATS.singleSet, noAd: true };
    const m = play(new TennisMatch(fmt, "A"), "AAABBB");
    expect(m.pointScore()).toBe("DEUCE");
    m.playPoint("B");
    expect(m.gamesB).toBe(1);
  });

  it("alternates server every game", () => {
    const m = new TennisMatch(FORMATS.singleSet, "A");
    expect(m.server).toBe("A");
    play(m, "AAAA");
    expect(m.server).toBe("B");
    play(m, "BBBB");
    expect(m.server).toBe("A");
  });
});

describe("set scoring", () => {
  it("needs six games and a two-game margin", () => {
    const m = new TennisMatch(FORMATS.singleSet, "A");
    // A wins 6, B wins 5 -> not over at 6-5.
    for (let g = 0; g < 5; g++) play(m, "AAAA");
    for (let g = 0; g < 5; g++) play(m, "BBBB");
    expect(m.gamesA).toBe(5);
    expect(m.gamesB).toBe(5);
    play(m, "AAAA");
    expect(m.isOver).toBe(false); // 6-5
    play(m, "AAAA");
    expect(m.winner).toBe("A"); // 7-5
    expect(m.scoreline()).toBe("7-5");
  });

  it("plays a tiebreak at 6-6 and records the loser's points", () => {
    const m = toSixAll(new TennisMatch(FORMATS.singleSet, "A"));
    expect(m.inTiebreak).toBe(true);

    play(m, "AAAAABB"); // 5-2
    play(m, "AA"); // 7-2
    expect(m.winner).toBe("A");
    expect(m.scoreline()).toBe("7-6(2)");
  });

  it("tiebreak needs a two-point margin", () => {
    const m = toSixAll(new TennisMatch(FORMATS.singleSet, "A"));
    play(m, "AAAAAABBBBBB"); // 6-6
    expect(m.isOver).toBe(false);
    play(m, "A");
    expect(m.isOver).toBe(false); // 7-6
    play(m, "A");
    expect(m.winner).toBe("A"); // 8-6
    expect(m.scoreline()).toBe("7-6(6)");
  });

  it("rotates serve 1-then-2 in a tiebreak", () => {
    const m = toSixAll(new TennisMatch(FORMATS.singleSet, "A"));
    const opener = m.server;
    const other: Side = opener === "A" ? "B" : "A";

    m.playPoint("A"); // point 1 served by opener
    expect(m.server).toBe(other);
    m.playPoint("A"); // point 2
    expect(m.server).toBe(other);
    m.playPoint("A"); // point 3
    expect(m.server).toBe(opener);
  });
});

describe("match scoring", () => {
  it("best-of-3 ends at two sets", () => {
    const m = new TennisMatch(FORMATS.bestOf3, "A");
    for (let s = 0; s < 2; s++) for (let g = 0; g < 6; g++) play(m, "AAAA");
    expect(m.winner).toBe("A");
    expect(m.scoreline()).toBe("6-0 6-0");
    expect(m.sets).toHaveLength(2);
  });

  it("substitutes a match tiebreak for the deciding set", () => {
    const m = new TennisMatch(FORMATS.bestOf3MatchTB, "A");
    for (let g = 0; g < 6; g++) play(m, "AAAA"); // A takes set 1
    for (let g = 0; g < 6; g++) play(m, "BBBB"); // B takes set 2
    expect(m.inTiebreak).toBe(true);
    expect(m.isMatchTiebreak).toBe(true);

    play(m, "AAAAAAAAAA"); // to 10
    expect(m.winner).toBe("A");
    expect(m.scoreline()).toBe("6-0 0-6 [10-0]");
  });

  it("refuses points after the match is over", () => {
    const m = new TennisMatch(FORMATS.bestOf3, "A");
    for (let s = 0; s < 2; s++) for (let g = 0; g < 6; g++) play(m, "AAAA");
    expect(() => m.playPoint("A")).toThrow();
  });

  it("counts games and breaks of serve", () => {
    const m = new TennisMatch(FORMATS.singleSet, "A");
    for (let g = 0; g < 6; g++) play(m, "AAAA"); // A wins every game
    const games = m.gamesWon();
    expect(games).toEqual({ a: 6, b: 0 });
    expect(m.breaksOfServe.A).toBe(3); // the 3 games B served
  });
});
