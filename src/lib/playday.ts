import {
  db,
  getMatchesBetween,
  getPlayDayByDate,
  getPlayers,
  ratingPeriodOf,
  type MatchRow,
  type SessionRow,
} from "./db";
import { dayBounds, playedAtFor } from "./dates";
import { parseScoreline } from "./engine/scoreline";
import type { MatchFormat } from "./engine/tennis";
import { deriveStats } from "./stats";

/**
 * Play days: the unit a night of tennis is recorded in.
 *
 * Everything here takes plain ids and returns plain results, with no cookies
 * or request context, so the same code is driven by the server actions and by
 * the self-test against a real database.
 */

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const asIds = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const unique = (ids: string[]) => [...new Set(ids)];

function sessionOf(row: Record<string, unknown>): SessionRow {
  return { ...(row as unknown as SessionRow), attendees: asIds(row.attendees) };
}

/**
 * Open the play day for a date: create it, or — if one already exists — add to
 * it. One play day per group per date is a database constraint, so two people
 * starting "today" at the same moment end up on the same page, not two.
 */
export async function openPlayDay(
  groupId: string,
  date: string,
  attendees: string[],
  createdBy: string | null,
): Promise<Result<{ day: SessionRow; created: boolean }>> {
  const existing = await getPlayDayByDate(groupId, date);
  if (existing) {
    const merged = unique([...existing.attendees, ...attendees]);
    if (merged.length === existing.attendees.length) return { ok: true, day: existing, created: false };
    const day = await writeAttendees(existing.id, merged);
    return day ? { ok: true, day, created: false } : { ok: false, error: "Couldn't update that play day." };
  }

  const { data, error } = await db()
    .from("tennis_sessions")
    .insert({ group_id: groupId, played_on: date, attendees: unique(attendees), created_by: createdBy })
    .select("*")
    .single();

  if (error?.code === "23505") {
    // Lost a race with someone else starting the same day: take theirs.
    const theirs = await getPlayDayByDate(groupId, date);
    if (theirs) return { ok: true, day: theirs, created: false };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true, day: sessionOf(data), created: true };
}

async function writeAttendees(sessionId: string, ids: string[]): Promise<SessionRow | null> {
  const { data, error } = await db()
    .from("tennis_sessions")
    .update({ attendees: ids, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .select("*")
    .single();
  return error || !data ? null : sessionOf(data);
}

/** Mark someone here, or not here. */
export async function setPresent(
  day: SessionRow,
  playerId: string,
  present: boolean,
): Promise<SessionRow | null> {
  const has = day.attendees.includes(playerId);
  if (present === has) return day;
  const next = present ? [...day.attendees, playerId] : day.attendees.filter((id) => id !== playerId);
  return writeAttendees(day.id, next);
}

/** Matches filed under a play day. */
export function matchesOn(groupId: string, date: string): Promise<MatchRow[]> {
  const { start, end } = dayBounds(date);
  return getMatchesBetween(groupId, start, end);
}

/**
 * Rebuild a player's wins / losses / streak from the ledger. Called after
 * every insert and delete, so "remove that match" is always exactly right.
 */
export async function recomputeStats(playerId: string): Promise<void> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select("player_a, player_b, winner_id, played_at, created_at")
    .eq("status", "confirmed")
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`);
  if (error) throw new Error(`recomputeStats: ${error.message}`);

  const stats = deriveStats(playerId, data ?? []);
  const { error: writeErr } = await db().from("tennis_players").update(stats).eq("id", playerId);
  if (writeErr) throw new Error(`recomputeStats write: ${writeErr.message}`);
}

export interface RecordInput {
  groupId: string;
  day: SessionRow;
  /** Player 1. The score is read from their side. */
  a: string;
  b: string;
  scoreline: string;
  format: MatchFormat;
  loggedBy: string;
}

/**
 * Record a result under a play day.
 *
 * There is no confirmation step, and that is deliberate. A play-day result is
 * logged by whoever is resting (or either player) with the room watching; the
 * safeguard is that anyone there can see it and remove it, not that a second
 * person must tap agree. The old confirm flow is still what the standalone log
 * screen uses.
 */
export async function recordMatch(
  input: RecordInput,
): Promise<Result<{ matchId: string; text: string; day: SessionRow }>> {
  const { groupId, a, b, scoreline, format, loggedBy } = input;
  let day = input.day;

  if (!a || !b) return { ok: false, error: "Pick both players." };
  if (a === b) return { ok: false, error: "That's the same person twice." };

  const roster = await getPlayers(groupId);
  const byId = new Map(roster.map((p) => [p.id, p]));
  if (!byId.has(a) || !byId.has(b)) return { ok: false, error: "Someone isn't in this league." };

  const parsed = parseScoreline(scoreline, format);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Playing implies being there. A referee who forgot to tick someone should
  // not be blocked, just corrected.
  for (const id of [a, b]) {
    if (!day.attendees.includes(id)) {
      const updated = await setPresent(day, id, true);
      if (updated) day = updated;
    }
  }

  const winnerId = parsed.value.winner === "A" ? a : b;
  const now = new Date().toISOString();
  const playedAt = playedAtFor(day.played_on);

  const { data, error } = await db()
    .from("tennis_matches")
    .insert({
      group_id: groupId,
      player_a: a,
      player_b: b,
      winner_id: winnerId,
      sets: parsed.value.sets,
      scoreline: scoreline.trim(),
      games_a: parsed.value.gamesA,
      games_b: parsed.value.gamesB,
      // Required columns from the ranked days. Nothing rates these: ranks are
      // off, so the match is marked already-rated and the rating job skips it.
      win_prob_a: 0.5,
      status: "confirmed",
      logged_by: loggedBy,
      confirmed_at: now,
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

  await Promise.all([recomputeStats(a), recomputeStats(b)]);

  const loser = winnerId === a ? b : a;
  const shown = winnerId === a ? scoreline.trim() : null;
  const text = `${byId.get(winnerId)!.name} beat ${byId.get(loser)!.name}${shown ? ` ${shown}` : ""}`;
  return { ok: true, matchId: data.id as string, text, day };
}

/** Take a result back out. Totals are rebuilt from what remains. */
export async function removeMatch(groupId: string, matchId: string): Promise<Result<{ text: string }>> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select("id, group_id, player_a, player_b")
    .eq("id", matchId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data || data.group_id !== groupId) return { ok: false, error: "That match isn't here." };

  const { error: delErr } = await db().from("tennis_matches").delete().eq("id", matchId);
  if (delErr) return { ok: false, error: delErr.message };

  await Promise.all([recomputeStats(data.player_a as string), recomputeStats(data.player_b as string)]);
  return { ok: true, text: "Removed." };
}
