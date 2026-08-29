"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  db,
  getGroupBySlug,
  getPlayer,
  getPlayers,
  getTournament,
  ratingPeriodOf,
} from "@/lib/db";
import { buildBracket, champion, setWinner, type Entrant } from "@/lib/engine/bracket";
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


// ── Tournaments ────────────────────────────────────────────────────────────

/**
 * Create a knockout draw.
 *
 * The client assembles the entrant list — it already knows who is ticked and
 * how pairs were made — but every member id is re-checked against the group
 * here. A client-supplied list of ids is exactly the sort of thing that must
 * not be taken on trust just because the UI produced it.
 */
export async function createTournamentAction(_prev: State, form: FormData): Promise<State> {
  const name = String(form.get("name") ?? "").trim() || "Tournament";
  const kind = form.get("kind") === "pair" ? "pair" : "solo";
  const seeded = form.get("seeded") !== "random";
  const raw = String(form.get("entrants") ?? "[]");

  const group = await getGroupBySlug(GROUP_SLUG);
  if (!group) return { error: "League not found." };

  let entrants: Entrant[];
  try {
    entrants = JSON.parse(raw) as Entrant[];
  } catch {
    return { error: "Could not read the field." };
  }

  if (!Array.isArray(entrants) || entrants.length < 2) {
    return { error: "You need at least two entrants." };
  }
  if (entrants.length > 32) return { error: "32 entrants is the maximum." };

  const roster = new Set((await getPlayers(group.id)).map((p) => p.id));
  for (const e of entrants) {
    if (!Array.isArray(e.members) || e.members.length !== (kind === "pair" ? 2 : 1)) {
      return { error: "Every side needs the right number of players." };
    }
    for (const m of e.members) {
      if (!roster.has(m)) return { error: "Someone in the draw isn't in this league." };
    }
  }

  const seen = new Set<string>();
  for (const e of entrants) {
    for (const m of e.members) {
      if (seen.has(m)) return { error: "Somebody is in the draw twice." };
      seen.add(m);
    }
  }

  const bracket = buildBracket(entrants, { seeded, seed: Date.now() % 100000 });
  if (!bracket) return { error: "That field can't make a bracket." };

  const { data, error } = await db()
    .from("tennis_tournaments")
    .insert({
      group_id: group.id,
      name: name.slice(0, 60),
      kind,
      seeded,
      bracket,
      created_by: form.get("meId") ? String(form.get("meId")) : null,
    })
    .select("id")
    .single();

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return { error: "Tournaments need a database update — run supabase/schema.sql." };
  }
  if (error) return { error: error.message };

  redirect(`/tournaments/${data.id as string}`);
}

/** Record who won a bracket match, and re-derive everything downstream. */
export async function advanceBracketAction(form: FormData): Promise<void> {
  const id = String(form.get("tournamentId") ?? "");
  const round = Number(form.get("round"));
  const index = Number(form.get("index"));
  const winnerId = String(form.get("winnerId") ?? "") || null;
  if (!id || Number.isNaN(round) || Number.isNaN(index)) return;

  const t = await getTournament(id);
  if (!t) return;

  const next = setWinner(t.bracket, round, index, winnerId);
  const king = champion(next);

  await db()
    .from("tennis_tournaments")
    .update({
      bracket: next,
      champion_name: king?.name ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath(`/tournaments/${id}`);
}

export async function deleteTournamentAction(form: FormData): Promise<void> {
  const id = String(form.get("tournamentId") ?? "");
  if (!id) return;
  await db().from("tennis_tournaments").delete().eq("id", id);
  redirect("/tournaments");
}
