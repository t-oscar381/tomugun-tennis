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
