import { cookies } from "next/headers";
import { db, getGroupBySlug, getPlayer, type GroupRow, type PlayerRow } from "./db";

/**
 * Identity, v1.
 *
 * A group join code typed once, then you pick which player you are. The choice
 * lives in a cookie. This is not authentication and does not pretend to be —
 * anyone with the code can claim to be anyone in the group. That is an
 * acceptable trade for a group of friends, and it is why the *confirmation*
 * step matters: a result only moves the ladder once the other player agrees.
 *
 * The upgrade path is deliberately cheap. Adding Supabase Auth means adding a
 * nullable user_id to tennis_players and checking it here — no schema rewrite,
 * no data migration.
 */

const COOKIE = "tennis_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface Session {
  group: GroupRow;
  player: PlayerRow;
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const playerId = jar.get(COOKIE)?.value;
  if (!playerId) return null;

  const player = await getPlayer(playerId);
  if (!player) return null;

  const { data } = await db()
    .from("tennis_groups")
    .select("*")
    .eq("id", player.group_id)
    .maybeSingle();
  if (!data) return null;

  return { group: data as GroupRow, player };
}

export async function setSessionPlayer(playerId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Constant-time-ish compare so the join code can't be probed by timing. */
export function codeMatches(supplied: string, actual: string): boolean {
  const a = supplied.trim().toUpperCase();
  const b = actual.trim().toUpperCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireGroup(slug: string): Promise<GroupRow> {
  const group = await getGroupBySlug(slug);
  if (!group) throw new Error(`No group "${slug}". Run supabase/schema.sql first.`);
  return group;
}
