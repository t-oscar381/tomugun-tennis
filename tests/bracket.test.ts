import { describe, expect, it } from "vitest";
import {
  buildBracket,
  champion,
  progress,
  roundName,
  seedOrder,
  setWinner,
  type Entrant,
} from "../src/lib/engine/bracket.js";

const field = (n: number): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    name: `Player ${i + 1}`,
    members: [`p${i + 1}`],
    seed: i + 1,
  }));

describe("seed order", () => {
  it("is the standard bracket order", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("keeps the top two seeds apart until the final", () => {
    const order = seedOrder(16);
    // Halves of the draw never meet before the final by construction.
    const top = order.slice(0, 8);
    expect(top).toContain(1);
    expect(top).not.toContain(2);
  });
});

describe("building a 16 draw", () => {
  const b = buildBracket(field(16))!;

  it("has four rounds ending in one final", () => {
    expect(b.size).toBe(16);
    expect(b.rounds).toHaveLength(4);
    expect(b.rounds[0]).toHaveLength(8);
    expect(b.rounds[3]).toHaveLength(1);
  });

  it("opens with the top seed against the bottom seed", () => {
    expect(b.rounds[0]![0]!.a).toBe("e1");
    expect(b.rounds[0]![0]!.b).toBe("e16");
  });

  it("names rounds the way people say them", () => {
    expect(roundName(0, 4)).toBe("Round of 16");
    expect(roundName(1, 4)).toBe("Quarter-finals");
    expect(roundName(2, 4)).toBe("Semi-finals");
    expect(roundName(3, 4)).toBe("Final");
  });

  it("counts every match that has to be played", () => {
    // A 16 draw is 15 matches: every entrant but one loses exactly once.
    expect(progress(b).total).toBe(15);
    expect(progress(b).played).toBe(0);
  });
});

describe("byes", () => {
  it("pads an awkward field and hands byes to the top seeds", () => {
    const b = buildBracket(field(6))!;
    expect(b.size).toBe(8);
    const byes = b.rounds[0]!.filter((m) => m.bye);
    expect(byes).toHaveLength(2);
    // Seeds 1 and 2 are the ones who get them.
    expect(byes.map((m) => m.winnerId).sort()).toEqual(["e1", "e2"]);
  });

  it("carries a bye winner into the next round automatically", () => {
    const b = buildBracket(field(6))!;
    const quarterSlots = b.rounds[1]!.flatMap((m) => [m.a, m.b]).filter(Boolean);
    expect(quarterSlots).toContain("e1");
    expect(quarterSlots).toContain("e2");
  });

  it("does not count a bye as a match to play", () => {
    expect(progress(buildBracket(field(6))!).total).toBe(5);
  });
});

describe("advancing", () => {
  it("puts the winner in the right half of the next match", () => {
    let b = buildBracket(field(8))!;
    b = setWinner(b, 0, 0, b.rounds[0]![0]!.a);
    b = setWinner(b, 0, 1, b.rounds[0]![1]!.b);
    expect(b.rounds[1]![0]!.a).toBe("e1");
    expect(b.rounds[1]![0]!.b).toBe(b.rounds[0]![1]!.b);
  });

  it("refuses a winner who isn't in the match", () => {
    const b = buildBracket(field(8))!;
    const after = setWinner(b, 0, 0, "e5");
    expect(after.rounds[0]![0]!.winnerId).toBeNull();
  });

  it("clears everything downstream when a result is corrected", () => {
    let b = buildBracket(field(4))!;
    b = setWinner(b, 0, 0, "e1");
    b = setWinner(b, 0, 1, "e2");
    b = setWinner(b, 1, 0, "e1");
    expect(champion(b)?.id).toBe("e1");

    // The semi was logged wrong: e4 actually beat e1.
    b = setWinner(b, 0, 0, "e4");
    expect(champion(b)).toBeNull();
    expect(b.rounds[1]![0]!.a).toBe("e4");
  });

  it("crowns a champion once the final is decided", () => {
    let b = buildBracket(field(4))!;
    b = setWinner(b, 0, 0, "e1");
    b = setWinner(b, 0, 1, "e3");
    expect(champion(b)).toBeNull();
    b = setWinner(b, 1, 0, "e3");
    expect(champion(b)?.id).toBe("e3");
    expect(progress(b)).toEqual({ played: 3, total: 3 });
  });
});

describe("a full draw has no byes anywhere", () => {
  it("never advances anyone who still has an opponent to come", () => {
    // Regression: the semi used to read "one player present, the other feeder
    // has no names in it yet, therefore a bye" and crowned a champion after
    // three matches of fifteen.
    let b = buildBracket(field(16))!;
    expect(b.rounds.flat().filter((m) => m.bye)).toHaveLength(0);

    b = setWinner(b, 0, 0, b.rounds[0]![0]!.a);
    b = setWinner(b, 1, 0, b.rounds[1]![0]!.a);

    expect(b.rounds[2]![0]!.bye).toBe(false);
    expect(b.rounds[2]![0]!.winnerId).toBeNull();
    expect(champion(b)).toBeNull();
  });

  it("still carries a genuine round-one bye forward", () => {
    // 6 in an 8 draw: seeds 1 and 2 walk into the semis.
    const b = buildBracket(field(6))!;
    const semiSlots = b.rounds[1]!.flatMap((m) => [m.a, m.b]);
    expect(semiSlots).toContain("e1");
    expect(semiSlots).toContain("e2");
    expect(b.rounds[1]!.filter((m) => m.bye)).toHaveLength(0);
  });
});

describe("pairs and random draws", () => {
  it("treats a pair as one side", () => {
    const pairs: Entrant[] = [
      { id: "t1", name: "Andre & Bimo", members: ["a", "b"], seed: 1 },
      { id: "t2", name: "Cakra & Dimas", members: ["c", "d"], seed: 2 },
    ];
    const b = buildBracket(pairs)!;
    expect(b.rounds).toHaveLength(1);
    expect(b.rounds[0]![0]!.a).toBe("t1");
  });

  it("reseeds a random draw so the structure still holds", () => {
    const b = buildBracket(field(8), { seeded: false, seed: 5 })!;
    expect(b.entrants.map((e) => e.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(b.entrants.map((e) => e.id)).size).toBe(8);
  });

  it("refuses a field too small to play", () => {
    expect(buildBracket(field(1))).toBeNull();
  });
});
