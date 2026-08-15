"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, getGroupBySlug, getPlayer, getPlayers, ratingPeriodOf } from "@/lib/db";
import { parseScoreline } from "@/lib/engine/scoreline";
import { GROUP_SLUG, formatFor } from "@/lib/league";
import { confirmMatch, runRatingPeriods, winChance } from "@/lib/rating";
import { clearSession, codeMatches, setSessionPlayer } from "@/lib/session";

type State = { error?: string };

/** Join the league: check the code, then claim (or create) a player. */
export async function joinAction(_prev: State, form: FormData): Promise<State> {
  const code = String(form.get("code") ?? "");
  const playerId = String(form.get("playerId") ?? "");
  const newName = String(form.get("newName") ?? "").trim();

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return { error: "League not found. Has supabase/schema.sql been run?" };
  if (!codeMatches(code, group.join_code)) return { error: "That join code isn't right." };

  if (playerId) {
    const player = await getPlayer(playerId);
    if (!player || player.group_id !== group.id) return { error: "Unknown player." };
    await setSessionPlayer(player.id);
    redirect("/");
  }

  if (!newName) return { error: "Pick a name, or choose who you are." };
  if (newName.length > 24) return { error: "That name is too long." };

  const { data, error } = await db()
    .from("tennis_players")
    .insert({ group_id: group.id, name: newName })
    .select("id")
    .single();

  // 23505 = unique_violation on (group_id, name).
  if (error?.code === "23505") return { error: "Someone already has that name." };
  if (error) return { error: error.message };

  await setSessionPlayer(data.id as string);
  redirect("/");
}

/**
 * Sign out. Lands on "/" rather than "/join" so the person sees what the app
 * is before being asked for a code again — which matters when someone signs
 * out on a shared phone and hands it to a friend.
 */
export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/");
}

/**
 * Log a finished match. The result is stored `pending` and moves nothing until
 * the opponent confirms — an unverified ledger is worse than no ladder at all.
 */
export async function logMatchAction(_prev: State, form: FormData): Promise<State> {
  const meId = String(form.get("meId") ?? "");
  const oppId = String(form.get("opponentId") ?? "");
  const raw = String(form.get("score") ?? "");

  if (!meId || !oppId) return { error: "Pick an opponent." };
  if (meId === oppId) return { error: "You can't play yourself." };

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return { error: "League not found." };

  const [me, opponent] = await Promise.all([getPlayer(meId), getPlayer(oppId)]);
  if (!me || !opponent) return { error: "Unknown player." };
  if (me.group_id !== group.id || opponent.group_id !== group.id) {
    return { error: "That player isn't in this league." };
  }

  const format = formatFor(group);
  const parsed = parseScoreline(raw, format);
  if (!parsed.ok) return { error: parsed.error };

  // The winner comes from the score itself. The form used to ask separately
  // and then reject the answer when the two disagreed; there is only one
  // question worth asking, so there is now only one answer to be wrong.
  const iWon = parsed.value.winner === "A";

  const winProbA = winChance(me, opponent);

  const { error } = await db()
    .from("tennis_matches")
    .insert({
      group_id: group.id,
      player_a: me.id,
      player_b: opponent.id,
      winner_id: iWon ? me.id : opponent.id,
      sets: parsed.value.sets,
      scoreline: raw.trim(),
      games_a: parsed.value.gamesA,
      games_b: parsed.value.gamesB,
      win_prob_a: winProbA,
      logged_by: me.id,
      rating_period: ratingPeriodOf(new Date()),
    });

  if (error) return { error: error.message };

  revalidatePath("/");
  redirect("/?logged=1");
}

/** The opponent agrees the result is right. This is what moves RP. */
export async function confirmAction(form: FormData): Promise<void> {
  const matchId = String(form.get("matchId") ?? "");
  if (!matchId) return;

  await confirmMatch(matchId);
  revalidatePath("/");
}

export async function disputeAction(form: FormData): Promise<void> {
  const matchId = String(form.get("matchId") ?? "");
  if (!matchId) return;

  // Disputes are deliberately a dead end rather than an edit flow: the two
  // players sort it out and re-log. Building an arbitration UI for a group of
  // friends would be solving a problem they don't have.
  await db().from("tennis_matches").update({ status: "disputed" }).eq("id", matchId);
  revalidatePath("/");
}

/** Fold closed weeks into Glicko-2. Safe to call repeatedly; it's a no-op once caught up. */
export async function recalcAction(): Promise<void> {
  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return;
  await runRatingPeriods(group.id);
  revalidatePath("/");
}

export async function listPlayers() {
  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return [];
  return getPlayers(group.id);
}
