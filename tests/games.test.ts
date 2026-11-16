import { describe, expect, it } from "vitest";
import {
  byDay,
  dayText,
  decodeGame,
  encodeGame,
  isDuplicate,
  pointsTable,
  relations,
  teamsError,
  type Game,
} from "../src/lib/games.js";

const names: Record<string, string> = { T: "Tommy", V: "Val", R: "Rene", S: "Stephanie", K: "Koi" };
const nameOf = (id: string) => names[id] ?? "?";

let n = 0;
const game = (a: string[], b: string[], win: "a" | "b", date = "2026-11-16", at = ""): Game => ({
  id: `g${++n}`,
  date,
  a,
  b,
  win,
  loggedBy: "T",
  createdAt: at || `2026-11-16T0${n % 10}:00:00Z`,
});

describe("the group's own example", () => {
  // Tommy & Val beat Rene & Stephanie; then Val & Koi lost to Tommy & Rene.
  const games = [game(["T", "V"], ["R", "S"], "a"), game(["V", "K"], ["T", "R"], "b")];
  const table = Object.fromEntries(pointsTable(games).map((r) => [r.id, r]));

  it("gives each member of the winning team one point", () => {
    expect(table.T!.points).toBe(2); // won both games
    expect(table.V!.points).toBe(1); // won the first, lost the second
    expect(table.R!.points).toBe(1); // lost the first, won the second
  });

  it("gives the losers nothing, but counts that they played", () => {
    expect(table.S).toMatchObject({ points: 0, played: 1, lost: 1 });
    expect(table.K).toMatchObject({ points: 0, played: 1, lost: 1 });
  });

  it("ranks by points", () => {
    expect(pointsTable(games)[0]!.id).toBe("T");
  });
});

describe("points table", () => {
  it("lists everyone on the overall table, even at 0–0", () => {
    const rows = pointsTable([game(["T"], ["V"], "a")], ["T", "V", "K"]);
    expect(rows.find((r) => r.id === "K")).toMatchObject({ points: 0, played: 0 });
  });

  it("lists only people who played, for a single day", () => {
    expect(pointsTable([game(["T"], ["V"], "a")]).map((r) => r.id).sort()).toEqual(["T", "V"]);
  });

  it("breaks a tie on points by win rate", () => {
    // R: 1 win in 1. K: 1 win in 3. Same points; R converted better.
    const gs = [
      game(["R"], ["S"], "a"),
      game(["K"], ["S"], "a"),
      game(["T"], ["K"], "a"),
      game(["V"], ["K"], "a"),
    ];
    const ids = pointsTable(gs).map((r) => r.id);
    expect(ids.indexOf("R")).toBeLessThan(ids.indexOf("K"));
  });
});

describe("storing a game", () => {
  const row = (sets: unknown) => ({
    id: "x",
    sets,
    played_at: "2026-11-16T05:00:00Z",
    created_at: "2026-11-16T10:00:00Z",
    logged_by: "T",
  });

  it("round-trips through the stored form", () => {
    const g = decodeGame(row(encodeGame(["T", "V"], ["R", "S"], "b")))!;
    expect(g).toMatchObject({ a: ["T", "V"], b: ["R", "S"], win: "b", date: "2026-11-16" });
  });

  it("files a game under its Jakarta date", () => {
    // 23:30 UTC on the 15th is 06:30 on the 16th in Jakarta.
    const g = decodeGame({ ...row(encodeGame(["T"], ["V"], "a")), played_at: "2026-11-15T23:30:00Z" })!;
    expect(g.date).toBe("2026-11-16");
  });

  it("ignores old tennis scorelines, which are stored as arrays", () => {
    expect(decodeGame(row([{ a: 6, b: 4 }]))).toBeNull();
  });

  it("ignores anything else that is not a game", () => {
    expect(decodeGame(row(null))).toBeNull();
    expect(decodeGame(row({ kind: "other" }))).toBeNull();
    expect(decodeGame(row({ kind: "game", a: ["T"], b: [], win: "a" }))).toBeNull();
    expect(decodeGame(row({ kind: "game", a: ["T", "V", "R"], b: ["S"], win: "a" }))).toBeNull();
    expect(decodeGame(row({ kind: "game", a: ["T"], b: ["V"], win: "c" }))).toBeNull();
  });
});

describe("team rules", () => {
  it("accepts doubles and singles", () => {
    expect(teamsError(["T", "V"], ["R", "S"])).toBeNull();
    expect(teamsError(["T"], ["R"])).toBeNull();
  });

  it("rejects an empty team, a team of three, and someone on both sides", () => {
    expect(teamsError([], ["R"])).not.toBeNull();
    expect(teamsError(["T", "V", "K"], ["R"])).not.toBeNull();
    expect(teamsError(["T", "V"], ["V", "R"])).toMatch(/both teams/);
  });
});

describe("two people logging the same result", () => {
  const just = (ms: number) => new Date(Date.now() - ms).toISOString();

  it("counts it once", () => {
    const recent = [game(["T", "V"], ["R", "S"], "a", "2026-11-16", just(10_000))];
    expect(isDuplicate(recent, ["T", "V"], ["R", "S"], "a")).toBe(true);
  });

  it("recognises it with the teams entered in the other order", () => {
    const recent = [game(["T", "V"], ["R", "S"], "a", "2026-11-16", just(10_000))];
    expect(isDuplicate(recent, ["S", "R"], ["V", "T"], "b")).toBe(true);
  });

  it("lets the same teams play again once a real game's worth of time has passed", () => {
    const recent = [game(["T", "V"], ["R", "S"], "a", "2026-11-16", just(5 * 60_000))];
    expect(isDuplicate(recent, ["T", "V"], ["R", "S"], "a")).toBe(false);
  });

  it("does not mistake a rematch the other way round for a duplicate", () => {
    const recent = [game(["T", "V"], ["R", "S"], "a", "2026-11-16", just(10_000))];
    expect(isDuplicate(recent, ["T", "V"], ["R", "S"], "b")).toBe(false);
  });
});

describe("who plays with and against whom", () => {
  const gs = [
    game(["T", "V"], ["R", "S"], "a"), // T wins with V
    game(["T", "R"], ["V", "K"], "a"), // T wins with R
    game(["T", "V"], ["R", "K"], "b"), // T loses with V
  ];
  const rel = relations("T", gs);

  it("tallies games and wins with each partner", () => {
    expect(rel.partners.find((p) => p.id === "V")).toMatchObject({ games: 2, wins: 1 });
    expect(rel.partners.find((p) => p.id === "R")).toMatchObject({ games: 1, wins: 1 });
  });

  it("tallies games and wins against each opponent", () => {
    expect(rel.opponents.find((p) => p.id === "R")).toMatchObject({ games: 2, wins: 1 });
  });

  it("puts the most-played partner first", () => {
    expect(rel.partners[0]!.id).toBe("V");
  });
});

describe("days and chat text", () => {
  it("groups games by day, newest day first", () => {
    const days = byDay([game(["T"], ["V"], "a", "2026-11-09"), game(["T"], ["V"], "a", "2026-11-16")]);
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-09"]);
  });

  it("writes the night up for the group chat", () => {
    const text = dayText("2026-11-16", [game(["T", "V"], ["R", "S"], "a")], nameOf);
    expect(text).toContain("Tommy & Val beat Rene & Stephanie");
    expect(text).toContain("Tommy 1");
    expect(text).not.toContain("Rene 1");
  });
});
