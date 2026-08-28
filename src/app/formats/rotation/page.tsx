import { redirect } from "next/navigation";
import { getPlayers } from "@/lib/db";
import { getSession } from "@/lib/session";
import { RotationPlanner } from "./planner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rotation night" };

export default async function RotationPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/join");

  const { team } = await searchParams;
  const teamSize = team === "2" ? 2 : 1;

  const players = (await getPlayers(session.group.id)).map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Rotation night — {teamSize === 2 ? "doubles" : "singles"}
        </h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          Tick everyone who turned up. The app draws every round for you, spreading court time and
          {teamSize === 2 ? " partners" : " opponents"} as evenly as the numbers allow.
        </p>
      </header>

      <RotationPlanner players={players} teamSize={teamSize} meId={session.player.id} />
    </div>
  );
}
