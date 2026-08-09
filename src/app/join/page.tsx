import { getGroupBySlug, getPlayers } from "@/lib/db";
import { GROUP_SLUG } from "@/lib/league";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
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

  // Names only — never the join code, and never anything that would let this
  // page double as a roster leak for a league you're not in.
  const players = (await getPlayers(group.id)).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Real tennis scoring, a ranked ladder that remembers. Enter the group code, then tell us
          who you are.
        </p>
      </div>
      <JoinForm players={players} />
    </div>
  );
}
