import { getGroupBySlug, getPlayers } from "@/lib/db";
import { GROUP_SLUG } from "@/lib/league";
import { codeMatches } from "@/lib/session";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

/**
 * Joining, in two steps.
 *
 * Step one is the code; step two is who you are. They used to be one screen,
 * which meant the roster of every player was rendered to anyone who opened the
 * page — so the code protected nothing — and the code itself was sitting in
 * the input's placeholder attribute, in plain sight.
 *
 * The code travels in the query string so a single link can carry it: paste
 * play-tennis.tomugun.com/join?c=CODE into the group chat and everyone lands
 * on step two. That is the same secret it always was, shared the same way —
 * anyone with the link is in, which is the deal for a friend group.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const group = await getGroupBySlug(GROUP_SLUG);

  if (!group) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold">No league yet</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Run <code className="text-[var(--color-ink)]">supabase/schema.sql</code> against the
          Supabase project, then reload. It seeds a group with the slug{" "}
          <code className="text-[var(--color-ink)]">{GROUP_SLUG}</code>.
        </p>
      </div>
    );
  }

  const attempted = typeof c === "string" && c.length > 0;
  const unlocked = attempted && codeMatches(c, group.join_code);

  // The roster is only ever sent to someone who already has the code.
  const players = unlocked
    ? (await getPlayers(group.id)).map((p) => ({ id: p.id, name: p.name, emoji: p.emoji }))
    : [];

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {unlocked
            ? "You're in. Now tell us who you are so your matches count for the right person."
            : "Real tennis, a ranked ladder that remembers. You'll need the group code from whoever invited you."}
        </p>
      </div>

      <JoinForm
        players={players}
        unlocked={unlocked}
        wrongCode={attempted && !unlocked}
        code={unlocked ? c : ""}
      />
    </div>
  );
}
