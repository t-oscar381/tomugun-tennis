import { ENTRY_COST, TIER_WIDTH, rankFromRp, type Tier } from "@/lib/engine/ranks";

/**
 * Rank presentation. The hidden MMR never appears here — players see a tier,
 * a division and a progress bar, and nothing else. Showing the raw Glicko
 * number would invite arguing with the maths instead of playing tennis.
 */

const TIER_COLOR: Record<Tier, string> = {
  Bronze: "var(--color-bronze)",
  Silver: "var(--color-silver)",
  Gold: "var(--color-gold)",
  Platinum: "var(--color-platinum)",
  Diamond: "var(--color-diamond)",
  Master: "var(--color-master)",
};

export function tierColor(tier: Tier): string {
  return TIER_COLOR[tier];
}

export function RankBadge({ rp, size = "md" }: { rp: number; size?: "sm" | "md" | "lg" }) {
  const r = rankFromRp(rp);
  const color = tierColor(r.tier);
  const pad = size === "lg" ? "px-3 py-1.5 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${pad}`}
      style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)` }}
    >
      <span
        aria-hidden
        className="inline-block size-2 rounded-full"
        style={{ background: color }}
      />
      {r.label}
    </span>
  );
}

/** Progress through the current tier, with the next threshold spelled out. */
export function RankProgress({ rp }: { rp: number }) {
  const r = rankFromRp(rp);
  const color = tierColor(r.tier);
  const isMaster = r.tier === "Master";
  const pct = isMaster ? 100 : Math.min(100, (r.progress / TIER_WIDTH) * 100);
  const toNext = isMaster ? 0 : Math.ceil(TIER_WIDTH - r.progress);

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-line)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="nums mt-1.5 flex justify-between text-xs text-[var(--color-muted)]">
        <span>{Math.round(rp)} RP</span>
        <span>{isMaster ? "top of the ladder" : `${toNext} to next`}</span>
      </div>
    </div>
  );
}

/**
 * What this player is risking. Surfacing the entry cost before a match is what
 * makes climbing feel weighty rather than automatic — it is the one Apex
 * mechanic this ladder leans on hardest.
 */
export function StakeNote({ rp }: { rp: number }) {
  const r = rankFromRp(rp);
  const cost = ENTRY_COST[r.tierIndex] ?? 0;
  return (
    <p className="nums text-xs text-[var(--color-muted)]">
      {r.tier} stake: <span className="text-[var(--color-ink)]">−{cost} RP</span> per match played
    </p>
  );
}

export function RpDelta({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[var(--color-muted)]">—</span>;
  const up = delta > 0;
  return (
    <span className={`nums font-semibold ${up ? "text-[var(--color-ace)]" : "text-[#ff8080]"}`}>
      {up ? "+" : ""}
      {delta}
    </span>
  );
}
