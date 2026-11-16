import Link from "next/link";
import { winRate, type Row } from "@/lib/games";
import { Avatar } from "./avatar";

interface Person {
  id: string;
  name: string;
}

const MEDAL = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

/**
 * Points, played, win rate. It is what the group argues over, so it has to be
 * readable at a glance: one big number per row, everything else quiet.
 */
export function PointsTable({
  rows,
  people,
  meId,
  link = true,
}: {
  rows: Row[];
  people: Person[];
  meId?: string;
  link?: boolean;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const anyPoints = rows.some((r) => r.points > 0);

  return (
    <div className="card overflow-hidden">
      <div className="eyebrow nums flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-3 text-muted">
        <span className="w-6 text-center">#</span>
        <span className="flex-1">Player</span>
        <span className="w-12 text-center">Played</span>
        <span className="hidden w-12 text-center sm:block">Win %</span>
        <span className="w-14 text-right">Points</span>
      </div>
      <ol className="divide-y divide-line">
        {rows.map((r, i) => {
          const p = byId.get(r.id);
          const isMe = r.id === meId;
          const medal = anyPoints && r.points > 0 ? MEDAL[i] : undefined;
          const label = (
            <>
              <span
                className="nums w-6 shrink-0 text-center text-sm font-bold"
                style={{ color: medal ?? "var(--color-muted)" }}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar id={r.id} name={p?.name ?? "?"} size={38} ring={medal} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{p?.name ?? "?"}</span>
                    {isMe && (
                      <span className="eyebrow rounded-full bg-clay px-2 py-0.5 !text-[9px] text-white">you</span>
                    )}
                  </span>
                  <span className="nums block text-xs text-muted sm:hidden">{winRate(r)} wins</span>
                </span>
              </span>
              <span className="nums w-12 text-center text-sm text-muted">{r.played}</span>
              <span className="nums hidden w-12 text-center text-sm sm:block">{winRate(r)}</span>
              <span className="display nums w-14 text-right text-2xl">{r.points}</span>
            </>
          );
          const cls = `flex items-center gap-3 px-4 py-3.5 ${link && p ? "transition-colors hover:bg-surface-2/70" : ""}`;
          return (
            <li key={r.id} className={isMe ? "bg-clay-soft/70" : undefined}>
              {link && p ? (
                <Link href={`/player/${r.id}`} className={cls}>
                  {label}
                </Link>
              ) : (
                <div className={cls}>{label}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The top three, on a podium. Only worth showing once someone has a point. */
export function Podium({ rows, people, link = true }: { rows: Row[]; people: Person[]; link?: boolean }) {
  const top = rows.filter((r) => r.points > 0).slice(0, 3);
  if (top.length < 3) return null;
  const byId = new Map(people.map((p) => [p.id, p]));
  // Second, first, third — the way a podium stands.
  const order = [top[1]!, top[0]!, top[2]!];
  const place = [2, 1, 3];
  const lift = ["sm:mt-6 mt-4", "", "sm:mt-10 mt-7"];

  return (
    <ol className="grid grid-cols-3 items-start gap-2.5 sm:gap-4">
      {order.map((r, i) => {
        const name = byId.get(r.id)?.name ?? "?";
        const first = place[i] === 1;
        return (
          <li key={r.id} className={lift[i]}>
            <Box
              href={link ? `/player/${r.id}` : undefined}
              className={`card flex flex-col items-center px-2 py-5 text-center transition-transform hover:-translate-y-0.5 ${
                first ? "!border-court !bg-court text-white" : ""
              }`}
            >
              <span className={`eyebrow ${first ? "text-lime" : "text-muted"}`}>
                {place[i] === 1 ? "1st" : place[i] === 2 ? "2nd" : "3rd"}
              </span>
              <Avatar
                id={r.id}
                name={name}
                size={first ? 60 : 48}
                ring={first ? "var(--color-lime)" : MEDAL[place[i]! - 1]}
                className="mt-3"
              />
              <span className="mt-3 w-full truncate px-1 text-sm font-bold">{name}</span>
              <span className="display nums mt-1 text-3xl leading-none">{r.points}</span>
              <span className={`mt-1 text-[11px] ${first ? "text-white/70" : "text-muted"}`}>
                {r.points === 1 ? "point" : "points"}
              </span>
            </Box>
          </li>
        );
      })}
    </ol>
  );
}

function Box({ href, className, children }: { href?: string; className: string; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
