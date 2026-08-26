"use client";

/**
 * Route-level error boundary.
 *
 * Every page here talks to Supabase on render, so a network blip used to
 * surface as Next's raw error screen. `reset()` re-runs the segment, which is
 * usually all a transient failure needs.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">That didn&apos;t load.</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Something went wrong reaching the league. It&apos;s usually temporary.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-xl bg-[var(--color-clay)] px-5 py-3 font-bold text-white"
      >
        Try again
      </button>
      {error.digest && (
        <p className="nums mt-4 text-xs text-[var(--color-muted)]">Reference: {error.digest}</p>
      )}
    </div>
  );
}
