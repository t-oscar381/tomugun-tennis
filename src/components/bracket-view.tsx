import {
  champion,
  entrantById,
  progress,
  roundName,
  type Bracket,
} from "@/lib/engine/bracket";
import { advanceBracketAction } from "@/app/actions";

/**
 * The draw, drawn.
 *
 * Laid out as one flex column per round with `justify-around`, which makes
 * each match sit centred against the two it feeds from — the classic bracket
 * shape, without a single absolute position or connector SVG to keep in sync
 * when the field size changes.
 *
 * Every side is a submit button in its own form, so recording a result works
 * with no client JavaScript at all. Tapping the same side again clears it,
 * which is how a mis-tap gets undone.
 */
export function BracketView({ bracket, id }: { bracket: Bracket; id: string }) {
  const king = champion(bracket);
  const { played, total } = progress(bracket);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="nums text-sm text-[var(--color-muted)]">
          {played} of {total} matches played
        </p>
        {king && (
          <p className="flex items-center gap-2 rounded-full bg-[var(--color-gold)]/15 px-4 py-1.5 font-bold text-[var(--color-gold)]">
            <span aria-hidden>👑</span> {king.name} is king
          </p>
        )}
      </div>

      {/* Horizontal scroll on phones: a 16 draw is four columns wide and
          squeezing it into 375px would make every name unreadable. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          {bracket.rounds.map((round, r) => (
            <div key={r} className="flex w-56 flex-col">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                {roundName(r, bracket.rounds.length)}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.map((m) => {
                  const a = entrantById(bracket, m.a);
                  const b = entrantById(bracket, m.b);
                  const ready = Boolean(m.a && m.b);

                  return (
                    <div
                      key={m.index}
                      className={`overflow-hidden rounded-xl border bg-[var(--color-surface)] ${
                        m.winnerId
                          ? "border-[var(--color-line)]"
                          : ready
                            ? "border-[var(--color-clay)]/50"
                            : "border-dashed border-[var(--color-line)]"
                      }`}
                    >
                      {([
                        { side: a, id: m.a },
                        { side: b, id: m.b },
                      ] as const).map((slot, i) => {
                        const won = m.winnerId !== null && m.winnerId === slot.id;
                        const lost = m.winnerId !== null && !won && slot.id !== null;

                        return (
                          <form
                            key={i}
                            action={advanceBracketAction}
                            className={i === 0 ? "border-b border-[var(--color-line)]" : ""}
                          >
                            <input type="hidden" name="tournamentId" value={id} />
                            <input type="hidden" name="round" value={m.round} />
                            <input type="hidden" name="index" value={m.index} />
                            {/* Tapping the current winner again clears the result. */}
                            <input type="hidden" name="winnerId" value={won ? "" : (slot.id ?? "")} />
                            <button
                              disabled={!slot.id || (!ready && !m.bye)}
                              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm disabled:cursor-default ${
                                won
                                  ? "bg-[var(--color-win)]/10 font-bold text-[var(--color-win)]"
                                  : lost
                                    ? "text-[var(--color-muted)] line-through decoration-1"
                                    : "font-semibold"
                              }`}
                            >
                              <span className="min-w-0 truncate">
                                {slot.side ? slot.side.name : m.bye ? "—" : "TBD"}
                              </span>
                              {slot.side && (
                                <span className="nums shrink-0 text-xs text-[var(--color-muted)]">
                                  {slot.side.seed}
                                </span>
                              )}
                            </button>
                          </form>
                        );
                      })}

                      {m.bye && (
                        <p className="bg-[var(--color-surface-2)] px-3 py-1 text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                          Bye
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Tap whoever won to send them through. Tap them again to undo — anything that depended on
        that result is recalculated, so a wrong tap never leaves the draw stuck.
      </p>
    </div>
  );
}
