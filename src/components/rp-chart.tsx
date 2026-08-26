import { TIERS, TIER_WIDTH, rankFromRp } from "@/lib/engine/ranks";
import { tierColor } from "./rank";

/**
 * RP over time, reconstructed from the match ledger.
 *
 * The obvious source looked like `tennis_rating_history.rp_after`, but that
 * column records RP at the moment the *weekly Glicko job* ran, not when RP
 * actually moved — RP changes on confirmation. Any backfill rates every week
 * in one pass, so every row ends up holding the same present-day value and
 * the curve comes out dead flat.
 *
 * Walking `rp_delta` over confirmed matches is exact by construction: it is
 * the same ledger that produced the current number, so the line always lands
 * on today's RP.
 *
 * Deliberately one series and no axes furniture: the useful questions are
 * "am I going up" and "when did I cross into Gold", and both are answered by
 * the shape plus the tier lines behind it.
 */

const W = 640;
const H = 180;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 18;

export function RpChart({ series, currentRp }: { series: number[]; currentRp: number }) {
  const values = series.map((v) => Math.max(0, v));

  // Two points is a line, not a trend. Below that, say so instead of drawing
  // something misleading.
  if (values.length < 3) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
        Not enough history to chart yet — play a few more weeks.
      </p>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  // Pad the range so a flat line doesn't sit welded to the floor, and so the
  // top of a climb isn't clipped against the frame.
  const top = Math.max(max * 1.08, max + 20);
  const bottom = Math.max(0, min - 20);
  const span = top - bottom || 1;

  const x = (i: number) => PAD_L + (i / (values.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - bottom) / span) * (H - PAD_T - PAD_B);

  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H - PAD_B} L${PAD_L},${H - PAD_B} Z`;

  const rank = rankFromRp(currentRp);
  const colour = tierColor(rank.tier);

  // Tier boundaries that actually fall inside the visible range — drawing all
  // six would be noise when someone has only ever been Bronze and Silver.
  const bands = TIERS.map((tier, i) => ({ tier, at: i * TIER_WIDTH })).filter(
    (b) => b.at > bottom && b.at < top && b.at > 0,
  );

  const last = values[values.length - 1]!;
  const first = values[0]!;
  const change = Math.round(last - first);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Rank points over time</h3>
        <span
          className={`nums text-sm font-semibold ${
            change > 0
              ? "text-[var(--color-win)]"
              : change < 0
                ? "text-[var(--color-loss)]"
                : "text-[var(--color-muted)]"
          }`}
        >
          {change > 0 ? "+" : ""}
          {change} all time
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Rank points across ${values.length - 1} ranked matches, currently ${Math.round(currentRp)}.`}
      >
        <defs>
          <linearGradient id="rpfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.28" />
            <stop offset="100%" stopColor={colour} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {bands.map((b) => (
          <g key={b.tier}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(b.at)}
              y2={y(b.at)}
              stroke={tierColor(b.tier)}
              strokeOpacity="0.35"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
            <text
              x={W - PAD_R}
              y={y(b.at) - 4}
              textAnchor="end"
              fontSize="10"
              fill={tierColor(b.tier)}
              opacity="0.8"
            >
              {b.tier}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#rpfill)" />
        <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(last)} r="4.5" fill={colour} />
        <circle cx={x(values.length - 1)} cy={y(last)} r="9" fill={colour} fillOpacity="0.18" />
      </svg>

      <p className="nums mt-1 text-xs text-[var(--color-muted)]">
        {values.length - 1} ranked matches · now {Math.round(currentRp)} RP
      </p>
    </div>
  );
}
