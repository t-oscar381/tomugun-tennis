import Link from "next/link";
import { PLAY_FORMATS, STATUS_LABEL, type PlayFormat } from "@/lib/engine/formats";
import { FORMAT_SHOTS, photo } from "@/lib/photos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ways to play" };

const STATUS_STYLE: Record<PlayFormat["status"], string> = {
  live: "bg-[var(--color-win)]/12 text-[var(--color-win)]",
  social: "bg-[var(--color-clay)]/12 text-[var(--color-clay)]",
  planned: "bg-[var(--color-muted)]/15 text-[var(--color-muted)]",
};

export default function FormatsPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Ways to play</h1>
        <p className="max-w-2xl text-[var(--color-muted)]">
          The ladder is one format, not the only one. Pick whichever suits the night — a serious
          singles match, or a social rotation where the app draws the fixtures and your partner
          changes every round.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {PLAY_FORMATS.map((f) => {
          const shot = FORMAT_SHOTS[f.id];
          const disabled = f.status === "planned";

          return (
            <article
              key={f.id}
              className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] ${
                disabled ? "opacity-70" : ""
              }`}
            >
              {shot && (
                <img
                  src={photo(shot.id, 800)}
                  alt={shot.alt}
                  loading="lazy"
                  className="h-40 w-full object-cover"
                />
              )}

              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_STYLE[f.status]}`}
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                  <span className="text-xs text-[var(--color-muted)]">{f.tagline}</span>
                </div>

                <h2 className="mt-2 text-lg font-bold tracking-tight">{f.name}</h2>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{f.blurb}</p>

                <ul className="mt-3 space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm">
                      <span aria-hidden className="text-[var(--color-clay)]">
                        ·
                      </span>
                      <span className="text-[var(--color-muted)]">{b}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 text-xs text-[var(--color-muted)]">
                  <span className="font-semibold text-[var(--color-ink)]">Best for:</span>{" "}
                  {f.bestFor}
                </p>

                <div className="mt-4 pt-1">
                  {f.href ? (
                    <Link
                      href={f.href}
                      className="block rounded-xl bg-[var(--color-clay)] px-4 py-3 text-center font-bold text-white"
                    >
                      {f.rotating ? "Draw the fixtures" : "Log a match"}
                    </Link>
                  ) : (
                    <p className="rounded-xl border border-dashed border-[var(--color-line)] px-4 py-3 text-center text-sm text-[var(--color-muted)]">
                      Not available yet
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="font-bold">Why doubles isn&apos;t ranked</h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          The ladder rates individuals with Glicko-2. Working out how much credit each half of a
          winning pair deserves is a different model altogether, and guessing would put invented
          numbers next to real ones. So doubles nights run as social fixtures for now — the draw,
          the courts and the rounds all work, the results just don&apos;t move anyone&apos;s rank.
        </p>
      </section>
    </div>
  );
}
