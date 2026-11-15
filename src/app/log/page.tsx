import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/db";
import { getSession } from "@/lib/session";
import { formatFor } from "@/lib/league";
import { LogForm } from "./log-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Log a match" };

export default async function LogPage() {
  const session = await getSession();
  if (!session) redirect("/join");

  const { group, player } = session;
  const format = formatFor(group);

  const opponents = (await getPlayers(group.id))
    .filter((p) => p.id !== player.id)
    .map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
    }));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight">Log a match</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Pick who you played, then tap the games each of you won. No typing, and we work out
          who won the match. Your opponent confirms before it goes in the record.
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          <Link href="/how" className="text-[var(--color-clay)] underline">
            How scoring works
          </Link>
        </p>
      </div>

      {opponents.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Nobody else has joined this league yet.
        </p>
      ) : (
        <LogForm opponents={opponents} format={format} />
      )}
    </div>
  );
}
