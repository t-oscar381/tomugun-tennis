import { db, getPlayers, ratingPeriodOf } from "./db";
import { dayBounds, dateOf, playedAtFor } from "./dates";
import {
  decodeGame,
  encodeGame,
  isDuplicate,
  teamName,
  teamsError,
  winners,
  type Game,
  type Side,
} from "./games";

/**
 * Reading and writing games. See games.ts for what a game is and why it lives
 * in `tennis_matches`.
 */

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const COLUMNS = "id, sets, played_at, created_at, logged_by";

type Row = { id: string; sets: unknown; played_at: string; created_at: string; logged_by: string };

/** Games for a league, newest first. Pass `date` for a single day. */
export async function getGames(
  groupId: string,
  opts: { date?: string; limit?: number } = {},
): Promise<Game[]> {
  let q = db()
    .from("tennis_matches")
    .select(COLUMNS)
    .eq("group_id", groupId)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 1000);

  if (opts.date) {
    const { start, end } = dayBounds(opts.date);
    q = q.gte("played_at", start).lt("played_at", end);
  }

  const { data, error } = await q;
  if (error) throw new Error(`getGames: ${error.message}`);
  return ((data ?? []) as Row[]).map(decodeGame).filter((g): g is Game => g !== null);
}

export interface RecordGameInput {
  groupId: string;
  /** The day to file it under. */
  date: string;
  a: string[];
  b: string[];
  win: Side;
  loggedBy: string;
}

/** Record who won. One tap's worth of information, validated like it was a form with twenty fields. */
export async function recordGame(
  input: RecordGameInput,
): Promise<Result<{ id: string; text: string; winners: string[] }>> {
  const { groupId, date, win, loggedBy } = input;
  const a = [...new Set(input.a)];
  const b = [...new Set(input.b)];

  const bad = teamsError(a, b);
  if (bad) return { ok: false, error: bad };
  if (win !== "a" && win !== "b") return { ok: false, error: "Say which team won." };

  const roster = await getPlayers(groupId);
  const byId = new Map(roster.map((p) => [p.id, p.name]));
  if (![...a, ...b].every((id) => byId.has(id))) {
    return { ok: false, error: "Someone isn't in this league." };
  }

  // Anyone can log, so two people watching the same court will sometimes both do it.
  const today = await getGames(groupId, { date, limit: 20 });
  if (isDuplicate(today, a, b, win)) {
    return { ok: false, error: "That result was just logged — it's already counted." };
  }

  const first = (ids: string[]) => ids[0]!;
  const winTeam = win === "a" ? a : b;
  const playedAt = playedAtFor(date);
  const now = new Date().toISOString();

  const { data, error } = await db()
    .from("tennis_matches")
    .insert({
      group_id: groupId,
      // The table's old shape wants two distinct players, a winner among them and
      // a handful of columns that only mattered to the ranked ladder. Teams are
      // disjoint, so the first member of each satisfies "two distinct players".
      player_a: first(a),
      player_b: first(b),
      winner_id: first(winTeam),
      sets: encodeGame(a, b, win),
      scoreline: "1-0",
      games_a: win === "a" ? 1 : 0,
      games_b: win === "b" ? 1 : 0,
      win_prob_a: 0.5,
      status: "confirmed",
      logged_by: loggedBy,
      confirmed_at: now,
      // Marked already-rated so the (switched-off) rating job never picks it up.
      rated_at: now,
      rp_delta_a: 0,
      rp_delta_b: 0,
      placement: false,
      rating_period: ratingPeriodOf(new Date(playedAt)),
      played_at: playedAt,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const nameOf = (id: string) => byId.get(id) ?? "?";
  const loseTeam = win === "a" ? b : a;
  return {
    ok: true,
    id: data.id as string,
    winners: winTeam,
    text: `${teamName(winTeam, nameOf)} beat ${teamName(loseTeam, nameOf)}`,
  };
}

/**
 * Take a game back out. Only ever deletes a *game*: a row that is not one (the
 * sample league's tennis matches) is refused rather than removed.
 */
export async function removeGame(groupId: string, gameId: string): Promise<Result<object>> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select(`${COLUMNS}, group_id`)
    .eq("id", gameId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data || data.group_id !== groupId) return { ok: false, error: "That game isn't here." };
  if (!decodeGame(data as Row)) return { ok: false, error: "That isn't a game." };

  const { error: delErr } = await db().from("tennis_matches").delete().eq("id", gameId);
  if (delErr) return { ok: false, error: delErr.message };
  return { ok: true };
}

export { dateOf, winners };
