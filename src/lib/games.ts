import { dateOf, formatDay } from "./dates";

/**
 * Games: the unit this group actually plays and records.
 *
 * A game is one team against another — two against two, usually, but one
 * against one works too — and the result is just who won. Every player on the
 * winning team gets one point. There are no sets, no tiebreaks, no scores to
 * enter: the 15-30-45 you play to on court stays on court. An earlier version
 * asked for a full tennis scoreline, and the group's verdict was that nobody
 * understood it.
 *
 * Storage: a game is a row in `tennis_matches`, with its teams in the `sets`
 * jsonb column (see GamePayload). That column was built for tennis scorelines
 * and is free-form, so recording games needs no schema change and no one has to
 * paste SQL. The cost is that the column name now lies a little; this file is
 * the only place that knows, and `decodeGame` quietly skips any row that is not
 * a game (the sample league's old tennis matches, for instance).
 */

export const MAX_TEAM = 2;
export const POINTS_PER_WIN = 1;

export type Side = "a" | "b";

export interface Game {
  id: string;
  /** Jakarta calendar date the game is filed under. */
  date: string;
  a: string[];
  b: string[];
  win: Side;
  loggedBy: string;
  createdAt: string;
}

/** What is stored in tennis_matches.sets for a game. */
export interface GamePayload {
  v: 1;
  kind: "game";
  a: string[];
  b: string[];
  win: Side;
}

export function encodeGame(a: string[], b: string[], win: Side): GamePayload {
  return { v: 1, kind: "game", a, b, win };
}

const isIds = (v: unknown): v is string[] =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= MAX_TEAM &&
  v.every((x) => typeof x === "string" && x.length > 0);

/** A stored row as a Game, or null if the row is anything else. */
export function decodeGame(row: {
  id: string;
  sets: unknown;
  played_at: string;
  created_at: string;
  logged_by: string;
}): Game | null {
  const s = row.sets as Partial<GamePayload> | null;
  // Tennis scorelines are stored as arrays; a game is an object.
  if (!s || Array.isArray(s) || typeof s !== "object" || s.kind !== "game") return null;
  if (!isIds(s.a) || !isIds(s.b) || (s.win !== "a" && s.win !== "b")) return null;

  return {
    id: row.id,
    date: dateOf(row.played_at),
    a: s.a,
    b: s.b,
    win: s.win,
    loggedBy: row.logged_by,
    createdAt: row.created_at,
  };
}

/** Why these two teams can't play each other, or null if they can. */
export function teamsError(a: string[], b: string[]): string | null {
  if (a.length === 0 || b.length === 0) return "Pick who played on both teams.";
  if (a.length > MAX_TEAM || b.length > MAX_TEAM) return "A team is one or two people.";
  const all = [...a, ...b];
  if (new Set(all).size !== all.length) return "Someone is on both teams.";
  return null;
}

export const winners = (g: Game): string[] => (g.win === "a" ? g.a : g.b);
export const losers = (g: Game): string[] => (g.win === "a" ? g.b : g.a);

export function teamName(ids: string[], nameOf: (id: string) => string): string {
  return ids.map(nameOf).join(" & ");
}

export interface Row {
  id: string;
  points: number;
  played: number;
  lost: number;
}

/**
 * Points table. Points are wins, so they are derived from the games on every
 * read — there is no stored total to drift, and removing a wrong game is just
 * deleting it.
 *
 * Pass `playerIds` to list everyone even at 0–0 (the overall table); omit it to
 * list only people who played in `games` (a single day).
 */
export function pointsTable(games: Game[], playerIds?: string[]): Row[] {
  const rows = new Map<string, Row>();
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { id, points: 0, played: 0, lost: 0 }));
    return r;
  };

  for (const id of playerIds ?? []) row(id);
  for (const g of games) {
    for (const id of winners(g)) {
      const r = row(id);
      r.points += POINTS_PER_WIN;
      r.played++;
    }
    for (const id of losers(g)) {
      const r = row(id);
      r.lost++;
      r.played++;
    }
  }

  const rate = (r: Row) => (r.played ? r.points / r.played : 0);
  return [...rows.values()].sort(
    (x, y) => y.points - x.points || rate(y) - rate(x) || y.played - x.played,
  );
}

export function winRate(r: Row): string {
  return r.played ? `${Math.round((r.points / r.played) * 100)}%` : "—";
}

export interface Relation {
  id: string;
  games: number;
  wins: number;
}

/**
 * Who a player has played with and against, and how it went. The partner
 * numbers answer "who do I win with?"; the opponent numbers settle arguments.
 */
export function relations(playerId: string, games: Game[]): { partners: Relation[]; opponents: Relation[] } {
  const partners = new Map<string, Relation>();
  const opponents = new Map<string, Relation>();
  const bump = (m: Map<string, Relation>, id: string, won: boolean) => {
    let r = m.get(id);
    if (!r) m.set(id, (r = { id, games: 0, wins: 0 }));
    r.games++;
    if (won) r.wins++;
  };

  for (const g of games) {
    const side: Side | null = g.a.includes(playerId) ? "a" : g.b.includes(playerId) ? "b" : null;
    if (!side) continue;
    const mine = side === "a" ? g.a : g.b;
    const theirs = side === "a" ? g.b : g.a;
    const won = g.win === side;
    for (const id of mine) if (id !== playerId) bump(partners, id, won);
    for (const id of theirs) bump(opponents, id, won);
  }

  const byGames = (x: Relation, y: Relation) => y.games - x.games || y.wins - x.wins;
  return { partners: [...partners.values()].sort(byGames), opponents: [...opponents.values()].sort(byGames) };
}

/** Group games by the day they were played, newest day first. */
export function byDay(games: Game[]): { date: string; games: Game[] }[] {
  const days = new Map<string, Game[]>();
  for (const g of games) {
    const list = days.get(g.date);
    if (list) list.push(g);
    else days.set(g.date, [g]);
  }
  return [...days.entries()]
    .sort(([x], [y]) => y.localeCompare(x))
    .map(([date, list]) => ({ date, games: list }));
}

const sameTeam = (x: string[], y: string[]) =>
  x.length === y.length && [...x].sort().join("|") === [...y].sort().join("|");

/**
 * Is this the result somebody else just logged?
 *
 * Anyone can log, so with six people watching one court two of them will
 * sometimes both do it. The same teams with the same winner twice inside
 * a minute and a half is not a second game — a game takes longer than that —
 * so it is refused rather than counted twice.
 */
export function isDuplicate(
  recent: Game[],
  a: string[],
  b: string[],
  win: Side,
  now: number = Date.now(),
  windowMs = 90_000,
): boolean {
  const winTeam = win === "a" ? a : b;
  const loseTeam = win === "a" ? b : a;
  return recent.some(
    (g) =>
      now - new Date(g.createdAt).getTime() < windowMs &&
      sameTeam(winners(g), winTeam) &&
      sameTeam(losers(g), loseTeam),
  );
}

/** Plain text for pasting into the group chat. */
export function dayText(date: string, games: Game[], nameOf: (id: string) => string): string {
  const ordered = [...games].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
  const lines = [`🎾 ${formatDay(date)} — ${games.length} ${games.length === 1 ? "game" : "games"}`];
  for (const g of ordered) {
    lines.push(`${teamName(winners(g), nameOf)} beat ${teamName(losers(g), nameOf)}`);
  }
  const table = pointsTable(games).filter((r) => r.points > 0);
  if (table.length) {
    lines.push("", "Points:");
    for (const r of table) lines.push(`${nameOf(r.id)} ${r.points}`);
  }
  return lines.join("\n");
}
