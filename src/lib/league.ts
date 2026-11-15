import { FORMATS, type MatchFormat } from "./engine/tennis";

/**
 * League-level constants and pure helpers.
 *
 * These live here rather than in app/actions.ts because a "use server" module
 * may only export async functions — Next rejects a plain const or a sync
 * helper at build time, and the error points at the export, not the cause.
 */

/**
 * Which league this deployment serves. Matches a slug in tennis_groups.
 *
 * Deliberately not NEXT_PUBLIC_ — see the note in src/lib/db.ts. Those names
 * are inlined at build time, so the Cloudflare variable would never be read.
 */
export const GROUP_SLUG =
  process.env.GROUP_SLUG ?? process.env.NEXT_PUBLIC_GROUP_SLUG ?? "jakarta";

export function formatFor(group: { format: string }): MatchFormat {
  return (FORMATS as Record<string, MatchFormat>)[group.format] ?? FORMATS.bestOf3MatchTB;
}

/**
 * Where the sample season lives. It is a separate group on purpose: every
 * query is scoped by group id, so demo players and matches stay out of the
 * real league without a "fake?" flag at each call site. Shown read-only at
 * /example; nobody can join it because the deployment's slug points elsewhere.
 */
export const EXAMPLE_SLUG = "example";

/**
 * Record book only. The group asked for plain records first: wins, losses,
 * head-to-head. Rank points are still computed underneath on every confirmed
 * match, so switching this on later needs no backfill — but note the repeat-
 * opponent decay in rating.ts counts lifetime meetings and must be made
 * per-season before ranks are shown to a group this small.
 */
export const SHOW_RANKS = false;
