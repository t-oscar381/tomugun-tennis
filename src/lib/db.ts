import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bracket } from "./engine/bracket";
import type { ParsedSet } from "./engine/scoreline";

/**
 * Supabase access, service-role only.
 *
 * Shares a project with celebration.tomugun.com, so every table is prefixed
 * `tennis_` — see supabase/schema.sql. The service key bypasses RLS and is
 * never exposed to the browser; each caller is a route handler or server
 * component that has already validated its input.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...        # server-only, never NEXT_PUBLIC_
 */

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  // SUPABASE_URL, not NEXT_PUBLIC_SUPABASE_URL, and that matters more than it
  // looks. Next *inlines* every NEXT_PUBLIC_ name into the bundle at build
  // time — the compiled output contains the literal string and no
  // `process.env` lookup at all. So the value is frozen to whatever the
  // machine that ran the build happened to have, and the Cloudflare variable
  // of the same name is silently ignored at runtime.
  //
  // Nothing here is ever read from the browser (all access is server-side
  // service-role), so there is no reason to expose it publicly. Dropping the
  // prefix makes it a genuine runtime lookup, which means wrangler.jsonc vars
  // and dashboard Secrets actually govern it — and a CI build with no
  // .env.local produces a working Worker instead of one with `undefined`
  // baked in. The old name stays as a fallback so an older deploy keeps working.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. " +
        "Copy .env.example to .env.local and fill them in.",
    );
  }
  if (!url.startsWith("http")) {
    // Guards the exact mistake of pasting a publishable key into the URL slot:
    // supabase-js would otherwise fail later with an opaque fetch error.
    throw new Error(
      `SUPABASE_URL must be the project URL (https://<ref>.supabase.co), got "${url.slice(0, 12)}…".`,
    );
  }

  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

// ── Row shapes ─────────────────────────────────────────────────────────────

export interface GroupRow {
  id: string;
  slug: string;
  name: string;
  join_code: string;
  format: string;
}

export interface PlayerRow {
  id: string;
  group_id: string;
  name: string;
  emoji: string;
  rating: number;
  rd: number;
  vol: number;
  rp: number;
  peak_rp: number;
  matches: number;
  wins: number;
  losses: number;
  streak: number;
}

export interface MatchRow {
  id: string;
  group_id: string;
  player_a: string;
  player_b: string;
  winner_id: string;
  sets: ParsedSet[];
  scoreline: string;
  games_a: number;
  games_b: number;
  win_prob_a: number;
  status: "pending" | "confirmed" | "disputed";
  logged_by: string;
  confirmed_at: string | null;
  rp_delta_a: number;
  rp_delta_b: number;
  placement: boolean;
  rating_period: string;
  rated_at: string | null;
  /** When the match happened. May be back-dated. */
  played_at: string;
  /** When the row was written — what the dispute window actually measures. */
  created_at: string;
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * "The table isn't there" — i.e. supabase/schema.sql hasn't been run yet.
 *
 * Two codes, because there are two layers: PostgREST answers PGRST205 from its
 * own schema cache before Postgres ever sees the query, and 42P01 comes from
 * Postgres itself when the cache is stale rather than empty.
 */
const SCHEMA_MISSING = new Set(["42P01", "PGRST205"]);

export async function getGroupBySlug(slug: string): Promise<GroupRow | null> {
  const { data, error } = await db()
    .from("tennis_groups")
    .select("id, slug, name, join_code, format")
    .eq("slug", slug)
    .maybeSingle();

  // Treat "table isn't there yet" as "no league", so a fresh deployment shows
  // the setup instructions on /join instead of a stack trace. Every other
  // error is real and should still be loud.
  if (error && SCHEMA_MISSING.has(error.code)) return null;
  if (error) throw new Error(`getGroupBySlug: ${error.message}`);
  return (data as GroupRow) ?? null;
}

export async function getPlayers(groupId: string): Promise<PlayerRow[]> {
  const { data, error } = await db()
    .from("tennis_players")
    .select("*")
    .eq("group_id", groupId)
    .order("rp", { ascending: false });
  if (error) throw new Error(`getPlayers: ${error.message}`);
  return (data ?? []) as PlayerRow[];
}

export async function getPlayer(id: string): Promise<PlayerRow | null> {
  const { data, error } = await db()
    .from("tennis_players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getPlayer: ${error.message}`);
  return (data as PlayerRow) ?? null;
}

export async function getMatches(
  groupId: string,
  opts: { limit?: number; playerId?: string; status?: MatchRow["status"] } = {},
): Promise<MatchRow[]> {
  let q = db()
    .from("tennis_matches")
    .select("*")
    .eq("group_id", groupId)
    .order("played_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.status) q = q.eq("status", opts.status);
  if (opts.playerId) q = q.or(`player_a.eq.${opts.playerId},player_b.eq.${opts.playerId}`);

  const { data, error } = await q;
  if (error) throw new Error(`getMatches: ${error.message}`);
  return (data ?? []) as MatchRow[];
}

/** Matches awaiting this player's confirmation — i.e. logged by someone else. */
export async function getPendingFor(groupId: string, playerId: string): Promise<MatchRow[]> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .neq("logged_by", playerId)
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`)
    .order("played_at", { ascending: false });
  if (error) throw new Error(`getPendingFor: ${error.message}`);
  return (data ?? []) as MatchRow[];
}

/**
 * Matches this player marked wrong, or had marked wrong against them.
 *
 * Disputes were previously write-only: the row flipped to `disputed` and
 * disappeared from every view, so neither player was ever told the result
 * needs re-logging. Surfacing them is what makes "that's wrong" a real
 * workflow rather than a delete button.
 */
export async function getDisputedFor(groupId: string, playerId: string): Promise<MatchRow[]> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "disputed")
    .or(`player_a.eq.${playerId},player_b.eq.${playerId}`)
    .order("played_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`getDisputedFor: ${error.message}`);
  return (data ?? []) as MatchRow[];
}

export async function getRatingHistory(playerId: string) {
  const { data, error } = await db()
    .from("tennis_rating_history")
    .select("rating_period, rating_before, rating_after, rd_after, rp_after, played")
    .eq("player_id", playerId)
    .order("rating_period", { ascending: true });
  if (error) throw new Error(`getRatingHistory: ${error.message}`);
  return data ?? [];
}

// ── Tournaments ────────────────────────────────────────────────────────────

export interface TournamentRow {
  id: string;
  group_id: string;
  name: string;
  kind: "solo" | "pair";
  seeded: boolean;
  bracket: Bracket;
  champion_name: string | null;
  created_at: string;
}

export async function getTournaments(groupId: string): Promise<TournamentRow[]> {
  const { data, error } = await db()
    .from("tennis_tournaments")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(25);

  // Same graceful degradation as the rest of the app: an un-migrated database
  // should show "run the schema", not a stack trace.
  if (error && SCHEMA_MISSING.has(error.code)) return [];
  if (error) throw new Error(`getTournaments: ${error.message}`);
  return (data ?? []) as TournamentRow[];
}

export async function getTournament(id: string): Promise<TournamentRow | null> {
  const { data, error } = await db()
    .from("tennis_tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error && SCHEMA_MISSING.has(error.code)) return null;
  if (error) throw new Error(`getTournament: ${error.message}`);
  return (data as TournamentRow) ?? null;
}

/**
 * Whether the tournaments table exists yet, so the UI can say so plainly.
 *
 * Deliberately a real select rather than `{ head: true }`: PostgREST answers a
 * HEAD request for a table that does not exist with **no error at all**, so the
 * head-based version of this check always returned true and the missing-table
 * banner never appeared. The failure only surfaced on submit, after someone
 * had filled the whole form in.
 */
export async function tournamentsReady(): Promise<boolean> {
  const { error } = await db().from("tennis_tournaments").select("id").limit(1);
  if (error && SCHEMA_MISSING.has(error.code)) return false;
  if (error) throw new Error(`tournamentsReady: ${error.message}`);
  return true;
}

// ── Play days ──────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  group_id: string;
  /** Jakarta calendar date, YYYY-MM-DD. */
  played_on: string;
  /** Player ids present that day. */
  attendees: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** jsonb comes back as whatever was stored; make it a clean string[] or nothing. */
function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function toSession(row: Record<string, unknown>): SessionRow {
  return { ...(row as unknown as SessionRow), attendees: asIds(row.attendees) };
}

/**
 * Whether the play-day table exists yet. A real select, not `head: true` —
 * PostgREST reports no error at all for a HEAD on a missing table (see
 * tournamentsReady above), which would make this always say yes.
 */
export async function sessionsReady(): Promise<boolean> {
  const { error } = await db().from("tennis_sessions").select("id").limit(1);
  if (error && SCHEMA_MISSING.has(error.code)) return false;
  if (error) throw new Error(`sessionsReady: ${error.message}`);
  return true;
}

export async function getPlayDay(id: string): Promise<SessionRow | null> {
  const { data, error } = await db().from("tennis_sessions").select("*").eq("id", id).maybeSingle();
  if (error && SCHEMA_MISSING.has(error.code)) return null;
  if (error) throw new Error(`getPlayDay: ${error.message}`);
  return data ? toSession(data) : null;
}

export async function getPlayDayByDate(groupId: string, date: string): Promise<SessionRow | null> {
  const { data, error } = await db()
    .from("tennis_sessions")
    .select("*")
    .eq("group_id", groupId)
    .eq("played_on", date)
    .maybeSingle();
  if (error && SCHEMA_MISSING.has(error.code)) return null;
  if (error) throw new Error(`getPlayDayByDate: ${error.message}`);
  return data ? toSession(data) : null;
}

export async function listPlayDays(groupId: string, limit = 40): Promise<SessionRow[]> {
  const { data, error } = await db()
    .from("tennis_sessions")
    .select("*")
    .eq("group_id", groupId)
    .order("played_on", { ascending: false })
    .limit(limit);
  if (error && SCHEMA_MISSING.has(error.code)) return [];
  if (error) throw new Error(`listPlayDays: ${error.message}`);
  return (data ?? []).map(toSession);
}

/** Confirmed matches whose played_at falls in [start, end), oldest first. */
export async function getMatchesBetween(
  groupId: string,
  start: string,
  end: string,
): Promise<MatchRow[]> {
  const { data, error } = await db()
    .from("tennis_matches")
    .select("*")
    .eq("group_id", groupId)
    .eq("status", "confirmed")
    .gte("played_at", start)
    .lt("played_at", end)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getMatchesBetween: ${error.message}`);
  return (data ?? []) as MatchRow[];
}

/** Monday (UTC) of the week a match belongs to — the Glicko-2 rating period. */
export function ratingPeriodOf(when: Date): string {
  const d = new Date(Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate()));
  // getUTCDay: 0 = Sunday. Shift so Monday starts the week.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}
